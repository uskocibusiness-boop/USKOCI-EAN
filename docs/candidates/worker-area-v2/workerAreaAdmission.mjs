/**
 * A fail-closed admission boundary for the V1 worker area wire format.
 * It cannot represent a region, country or a union of cities. The model may
 * discuss those wishes, but it must not turn them into one active city/radius
 * or a public biography claim while that wire format is in use.
 *
 * This is deliberately a narrow recognizer, not a gazetteer or geocoder.
 */
const letters = '[\\p{L}]';
const capitals = '[\\p{Lu}]';
const namedPlace = `${capitals}${letters}+(?:\\s+${capitals}${letters}+){0,2}`;
const pair = new RegExp(`(?:^|[\\s,;])(?:u\\s+)?(${namedPlace})\\s+(?:i|ili)\\s+(?:u\\s+)?(${namedPlace})(?=$|[\\s,.;!?])`, 'u');
const commaPair = new RegExp(`(?:^|[\\s,;])(${namedPlace})\\s*,\\s*(${namedPlace})(?=$|[\\s,.;!?])`, 'u');
const broadScope = /(?:^|[^\p{L}])(?:cela|celoj|celu|ceo|čitava|čitavoj|čitavu|čitav|širom|svuda(?:\s+po)?|po\s+celoj|u\s+celoj|na\s+teritoriji\s+cele)\s+(?:republike?\s+)?(srbija|srbiji|srbiju|vojvodina|vojvodini|vojvodinu|šumadija|šumadiji|balkan|balkanu|država|državi|zemlja|zemlji|region|regija|regiji|pokrajina|pokrajini)(?=$|[^\p{L}])/iu;
const country = /(?:^|[^\p{L}])(?:srbija|srbiji|srbiju)(?=$|[^\p{L}])/iu;
const namedRegion = /(?:^|[^\p{L}])(?:vojvodina|vojvodini|vojvodinu|šumadija|šumadiji|balkan|balkanu)(?=$|[^\p{L}])/iu;
const surroundings = /(?:^|[^\p{L}])(?:okolina|okolini|okolinu|okolna|okolnim|okolo)(?=$|[^\p{L}])/iu;
const distance = /(?:^|[^\p{L}])\d{1,3}\s*(?:km|kilomet(?:ar|ra|ara|ri))(?=$|[^\p{L}])/iu;
const remoteOnly = /(?:^|[^\p{L}])(?:samo|isključivo)\s+(?:za\s+)?(?:onlajn|online|na\s+daljinu|remote)(?:\s+rad)?(?=$|[^\p{L}])/iu;
const onSiteWork = /(?:^|[^\p{L}])(?:terenski\s+rad|na\s+terenu|na\s+lokaciji|uživo|na\s+licu\s+mesta|dolazim)(?=$|[^\p{L}])/iu;
const remoteAreaOnly = text => {
  const remote = remoteOnly.exec(text);
  if (!remote || onSiteWork.test(text)) return false;
  // "samo online prevod" qualifies a separate service, not the preceding
  // on-site area. A remote-only area clause ends at "online" or "online rad".
  const tail = text.slice(remote.index + remote[0].length).trim();
  const administrativeTail = new RegExp(`^[Uu]\\s+${namedPlace}(?:\\s+i\\s+(?:okolin[\\p{L}]*|${namedPlace}))?[.!?]*$`, 'u');
  if (tail && !administrativeTail.test(tail) && !/^[.!?]+$/u.test(tail)) return false;
  return remoteOnly.test(text.slice(0, 25)) ||
    /(?:ali|nego|[,;])\s*(?:samo|isključivo)\s+(?:za\s+)?(?:onlajn|online|na\s+daljinu|remote)/iu.test(text) ||
    /(?:živim|adres|prebivališt)/iu.test(text.slice(0, remote.index));
};
const travelQuestion = /(?:^|[.!?]\s*)([^.!?]{0,160}(?:koliko\s+(?:daleko|kilometara)|do\s+koliko\s+km|koliki\s+(?:krug|radijus)|dokle\s+(?:putuješ|ideš|dolaziš))[^.!?]*\?)/giu;
const cyrillic = Object.fromEntries([
  ['А','A'],['Б','B'],['В','V'],['Г','G'],['Д','D'],['Ђ','Đ'],['Е','E'],['Ж','Ž'],['З','Z'],['И','I'],['Ј','J'],
  ['К','K'],['Л','L'],['Љ','Lj'],['М','M'],['Н','N'],['Њ','Nj'],['О','O'],['П','P'],['Р','R'],['С','S'],['Т','T'],
  ['Ћ','Ć'],['У','U'],['Ф','F'],['Х','H'],['Ц','C'],['Ч','Č'],['Џ','Dž'],['Ш','Š'],
  ['а','a'],['б','b'],['в','v'],['г','g'],['д','d'],['ђ','đ'],['е','e'],['ж','ž'],['з','z'],['и','i'],['ј','j'],
  ['к','k'],['л','l'],['љ','lj'],['м','m'],['н','n'],['њ','nj'],['о','o'],['п','p'],['р','r'],['с','s'],['т','t'],
  ['ћ','ć'],['у','u'],['ф','f'],['х','h'],['ц','c'],['ч','č'],['џ','dž'],['ш','š'],
]);
const normalize = value => String(value ?? '').normalize('NFKC').replace(/[\u0400-\u04ff]/gu, letter => cyrillic[letter] ?? letter)
  .replace(/\s+/gu, ' ').trim();
const independentQuestions = message => (String(message).match(/[^.!?]{2,160}\?/gu) ?? [])
  .map(question => question.trim())
  .filter(question => !/(?:grad|područ|krug|km|kilomet|region|držav|okolin|srb|vojvodin)/iu.test(question))
  .slice(0, 2);

export function classifyWorkerAreaRequest(input) {
  const text = normalize(input);
  if (!text) return 'NONE';
  // A stated exclusion or a remote-only correction is not a request to add
  // on-site coverage. Let the ordinary service-mode conversation handle it.
  if (remoteAreaOnly(text)) return 'NONE';
  // A current single-city correction supersedes cities mentioned as history
  // or family context; those mentions are not a request for two work areas.
  const currentSingleCity = new RegExp(`(?:^|[^\\p{L}])(?:(?:sad|sada|trenutno)\\s+)?radim\\s+samo\\s+u\\s+${namedPlace}(?=$|[^\\p{L}])`, 'iu').exec(text);
  if (currentSingleCity && (/(?:^|[^\p{L}])(?:sad|sada|trenutno)(?=$|[^\p{L}])/iu.test(currentSingleCity[0]) ||
    /(?:ranije|nekad|porodic)/iu.test(text.slice(0, currentSingleCity.index)))) return 'NONE';
  // Whole-country/region language takes precedence over a place-like pair.
  const broad = broadScope.exec(text);
  if (broad) {
    const before = text.slice(Math.max(0, broad.index - 40), broad.index);
    const after = text.slice(broad.index + broad[0].length);
    const localityCorrection = new RegExp(`(?:^|[^\\p{L}])(?:[Aa]li|[Nn]ego)\\s+(?:[Ss]ada\\s+)?[Ss]amo\\s+(?:[Uu]\\s+)?${namedPlace}(?=$|[,.;!?])`, 'u');
    if (/(?:^|[^\p{L}])(?:ne\s+(?:želim|radim|idem|prihvatam|nudim)|neću|nemoj|bez)\s*$/iu.test(before)
      || localityCorrection.test(after)) return 'NONE';
    if (country.test(broad[1])) return 'COUNTRY';
    return 'REGION';
  }
  if (namedRegion.test(text) && (text === namedRegion.exec(text)?.[0]?.trim() ||
    /(?:^|[^\p{L}])(?:radim|idem|dolazim|prihvatam|poslovi|područje|teren)\s+(?:po|u|na)\s+(?:celoj\s+)?(?:vojvodini|vojvodina|šumadiji|šumadija|balkanu|balkan)(?=$|[^\p{L}])/iu.test(text))) return 'REGION';
  if (/(?:^|[^\p{L}])(?:više|dva|tri|nekoliko)\s+gradova(?=$|[^\p{L}])/iu.test(text)) return 'MULTI_LOCALITY';
  const joined = pair.exec(text), listed = commaPair.exec(text);
  if (joined && !/^(?:Bosna|Bosni)$/iu.test(joined[1]) && !/^(?:Hercegovina|Hercegovini)$/iu.test(joined[2])
    && !country.test(joined[1]) && !country.test(joined[2])
    && !namedRegion.test(joined[1]) && !namedRegion.test(joined[2])) return 'MULTI_LOCALITY';
  if (listed && !country.test(listed[1]) && !country.test(listed[2])
    && !namedRegion.test(listed[1]) && !namedRegion.test(listed[2])) return 'MULTI_LOCALITY';
  if (surroundings.test(text) && !distance.test(text)) return 'LOCALITY_NEEDS_DISTANCE';
  return 'NONE';
}

/** Pure, post-provider guard. All returned patches still pass the DB validator. */
export function guardWorkerAreaOutput(output, userText, context) {
  // REVIEW/BLOCK intentionally freeze the DB candidate. Never downgrade them
  // to CLARIFY, which would make an otherwise ignored patch writable.
  if (!['ALLOW', 'CLARIFY'].includes(output.safety)) return output;
  const scope = classifyWorkerAreaRequest(userText);
  const patch = { ...output.patch };
  const removedUnsupportedBio = typeof patch.bio === 'string' && classifyWorkerAreaRequest(patch.bio) !== 'NONE';
  if (removedUnsupportedBio) {
    const safeSentences = patch.bio.split(/(?<=[.!?])\s+/u)
      .filter(sentence => classifyWorkerAreaRequest(sentence) === 'NONE');
    if (safeSentences.length) patch.bio = safeSentences.join(' ').trim();
    else delete patch.bio;
  }
  if (scope === 'NONE') {
    if (remoteAreaOnly(normalize(userText))) {
      if (patch.location && Object.hasOwn(patch.location, 'radiusKm')) {
        const { radiusKm: _radiusKm, ...administrativeLocation } = patch.location;
        if (Object.keys(administrativeLocation).length) patch.location = administrativeLocation;
        else delete patch.location;
      }
      const withoutTravelQuestion = String(output.assistantMessage).replace(travelQuestion, ' ').replace(/\s+/gu, ' ').trim();
      if (withoutTravelQuestion !== output.assistantMessage || removedUnsupportedBio)
        return { ...output, patch, ...(removedUnsupportedBio ? { safety: 'CLARIFY' } : {}),
          assistantMessage: withoutTravelQuestion && !removedUnsupportedBio ? withoutTravelQuestion
            : ['Za onlajn rad nije potrebno određivati područje putovanja. Ostale jasne izmene su u nacrtu.',
              ...independentQuestions(withoutTravelQuestion)].join(' ') };
      return { ...output, patch };
    }
    const proposed = patch.location;
    const current = context?.candidate?.location;
    const cityChanged = proposed?.city !== undefined && normalize(proposed.city).toLocaleLowerCase('sr') !==
      normalize(current?.city).toLocaleLowerCase('sr');
    // V1 stores the wish as city/radius, but the matcher reaches surrounding
    // towns only with a confirmed coarse centre. Do not promise that reach.
    if (!proposed || !distance.test(normalize(userText)) || (!cityChanged && current?.approximatePosition)) {
      return removedUnsupportedBio ? { ...output, safety: 'CLARIFY', patch,
        assistantMessage: ['Širi opis područja nisam dodao u nacrt. Ostale jasne izmene ostaju u nacrtu.',
          ...independentQuestions(output.assistantMessage)].join(' ') } : output;
    }
    const caveat = 'Za okolna mesta još ne mogu da obećam automatske predloge; za to treba potvrditi približan centar grada.';
    return { ...output, ...(removedUnsupportedBio ? { safety: 'CLARIFY', patch } : {}),
      assistantMessage: output.assistantMessage.length + caveat.length + 1 <= 1200 && !removedUnsupportedBio
        ? `${output.assistantMessage} ${caveat}`
        : [caveat, ...independentQuestions(output.assistantMessage)].join(' ') };
  }
  if (scope === 'LOCALITY_NEEDS_DISTANCE') {
    const current = context?.candidate?.location;
    const proposed = patch.location;
    const statedCity = new RegExp(`(${namedPlace})\\s+i\\s+okolin`, 'iu').exec(normalize(userText))?.[1];
    // An unchanged, already owned city/radius remains a valid draft fact. A
    // new locality cannot inherit a default or a different city's radius.
    const existingAreaRestated = !proposed && current?.city && current?.radiusKm &&
      (!statedCity || normalize(current.city).toLocaleLowerCase('sr') === normalize(statedCity).toLocaleLowerCase('sr'));
    if (existingAreaRestated || (current?.city && proposed && normalize(current.city).toLocaleLowerCase('sr') ===
      normalize(proposed.city ?? current.city).toLocaleLowerCase('sr') &&
      (proposed.radiusKm === undefined || current?.radiusKm === proposed.radiusKm))) {
      if (current.approximatePosition && !removedUnsupportedBio) return output;
      const caveat = current.approximatePosition
        ? 'Širi opis područja nisam dodao u nacrt.'
        : 'Dosadašnji grad i radijus ostaju isti. Za okolna mesta još ne mogu da obećam automatske predloge; za to treba potvrditi približan centar grada.';
      return { ...output, ...(removedUnsupportedBio ? { safety: 'CLARIFY', patch } : {}),
        assistantMessage: [caveat, ...independentQuestions(output.assistantMessage)].join(' ') };
    }
    delete patch.location;
    const message='Razumem grad i okolinu. Do koliko kilometara ti odgovara da ideš? Dosadašnje područje ostaje isto dok to ne razjasnimo.';
    return { ...output, safety: 'CLARIFY', patch,
      assistantMessage: [message,...independentQuestions(output.assistantMessage)].join(' ') };
  }
  delete patch.location;
  // A broad area in a biography would become a second, unsourced public truth.
  // Preserve unrelated identity/services/calendar changes from the same turn.
  // The common scrub above also protects a locality-without-distance claim.
  const message = scope === 'COUNTRY'
    ? 'Razumem, želiš celu Srbiju. Trenutno mogu da sačuvam samo jedan grad; neću celu Srbiju svesti na krug oko njega. Koji grad želiš za sada? Dosadašnje područje ostaje isto.'
    : scope === 'REGION'
      ? 'Razumem, želiš širu oblast. To još ne mogu da sačuvam kao područje rada. Koji grad želiš za sada? Dosadašnje područje ostaje isto.'
      : 'Razumem, radiš u više gradova. Za sada mogu da sačuvam samo jedan grad; neću ih spojiti u jedan veliki krug. Koji grad želiš za sada? Dosadašnje područje ostaje isto.';
  // Keep an independent, already targeted question (most often a missing
  // calendar end time) without retaining any provider assertion about area.
  const otherQuestions = independentQuestions(output.assistantMessage);
  return { ...output, safety: 'CLARIFY', patch, assistantMessage: [message, ...otherQuestions].join(' ') };
}
