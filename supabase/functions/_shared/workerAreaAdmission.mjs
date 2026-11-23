import { WORKER_AREA_LIMIT } from './workerRegions.mjs';
/**
 * A conservative post-provider admission boundary for the V1 worker area wire format.
 * It cannot represent a region, country or a union of cities. The model may
 * discuss those wishes, but it must not turn them into one active city/radius
 * or a public biography claim while that wire format is in use.
 *
 * This is deliberately a bounded recognizer, not a gazetteer or geocoder.
 * The current handler also uses this guard when a provider omits areaRequests.
 * In that case, typed workAreas may already exist: this guard must not claim
 * the server only supports one city. It never grants new territory itself.
 */
const letters = '[\\p{L}]';
const capitals = '[\\p{Lu}]';
const namedPlace = `${capitals}${letters}+(?:\\s+${capitals}${letters}+){0,2}`;
const areaCommandWords = new Set(['dodaj', 'dodajte', 'dodam', 'ubaci', 'ubacite', 'ubacim', 'proširi', 'proširite', 'zameni', 'zamenite', 'promeni', 'promenite']);
const pair = new RegExp(`(?:^|[\\s,;])(?:u\\s+)?(${namedPlace})\\s+(?:i|ili|a)\\s+(?:u\\s+)?(${namedPlace})(?=$|[\\s,.;!?])`, 'u');
const commaPair = new RegExp(`(?:^|[\\s,;])(${namedPlace})\\s*,\\s*(${namedPlace})(?=$|[\\s,.;!?])`, 'u');
const broadScope = /(?:^|[^\p{L}])(?:(?:širom\s+)?(?:cela|cele|celoj|celu|ceo|celom|čitava|čitave|čitavoj|čitavu|čitav)|širom|svuda(?:\s+po)?|po\s+(?:celoj|celom)|u\s+(?:celoj|celom)|na\s+(?:području|teritoriji)\s+(?:cele|čitave))?\s*(?:republike?\s+)?(srbija|srbije|srbiji|srbiju|vojvodina|vojvodine|vojvodini|vojvodinu|šumadija|šumadije|šumadiji|balkan|balkana|balkanu|svet|svetu|sveta|država|države|državi|zemlja|zemlje|zemlji|region|regiona|regija|regije|regiji|pokrajina|pokrajine|pokrajini|svuda|bilo gde|gde god)(?=$|[^\p{L}])/iu;
const country = /(?:^|[^\p{L}])(?:srbija|srbije|srbiji|srbiju)(?=$|[^\p{L}])/iu;
const countryWork = /(?:^|[^\p{L}])(?:radim|radimo|dolazim|idem|prihvatam|pokrivam|poslovi|rad)\s+(?:po|u|na)\s+(?:srbija|srbije|srbiji|srbiju)(?=$|[^\p{L}])/iu;
const namedRegion = /(?:^|[^\p{L}])(?:vojvodina|vojvodine|vojvodini|vojvodinu|šumadija|šumadije|šumadiji|balkan|balkana|balkanu)(?=$|[^\p{L}])/iu;
const surroundings = /(?:^|[^\p{L}])(?:okolina|okolini|okolinu|okolna|okolnim|okolo)(?=$|[^\p{L}])/iu;
const distance = /(?:^|[^\p{L}])\d{1,3}\s*(?:km|kilomet(?:ar|ra|ara|ri))(?=$|[^\p{L}])/iu;
const cityDistancePair = new RegExp(`(?:^|[^\\p{L}])(?:u\\s+)?(${namedPlace})\\s+(?:do\\s+)?\\d{1,3}\\s*(?:km|kilomet(?:ar|ra|ara|ri))\\s+(?:i|ili|a)\\s+(?:u\\s+)?(${namedPlace})\\s+(?:do\\s+)?\\d{1,3}\\s*(?:km|kilomet(?:ar|ra|ara|ri))(?=$|[^\\p{L}])`, 'iu');
const workCorridor = new RegExp(`(?:^|[^\\p{L}])(?:radim|prihvatam|dolazim|idem|poslovi|područje)\\s+(?:od\\s+)?${namedPlace}\\s+do\\s+${namedPlace}(?=$|[^\\p{L}])`, 'iu');
const routeCorridor = new RegExp(`(?:^|[^\\p{L}])(?:na\\s+relaciji|između)\\s+${namedPlace}\\s*[-–—]\\s*${namedPlace}(?=$|[^\\p{L}])`, 'iu');
// Proper-name casing is not reliable in chat. These are deliberately bounded
// city aliases, not a claim that we can resolve arbitrary locality names. A
// joined pair is rejected only when both aliases identify different cities.
const knownCity = '(?:novi\\s+sad|novom\\s+sadu|novog\\s+sada|beograd(?:u|a)?|niš(?:u|a)?|kragujev(?:ac|cu|ca))';
const knownCityPair = new RegExp(`(?:^|[^\\p{L}])(${knownCity})(?:\\s*,\\s*|\\s+(?:i|ili|a)\\s+)(?:u\\s+)?(${knownCity})(?=$|[^\\p{L}])`, 'iu');
const knownCityId = value => {
  const city = normalize(value).toLocaleLowerCase('sr');
  if (/^nov(?:i sad|om sadu|og sada)$/u.test(city)) return 'NOVI_SAD';
  if (/^beograd(?:u|a)?$/u.test(city)) return 'BEOGRAD';
  if (/^niš(?:u|a)?$/u.test(city)) return 'NIS';
  if (/^kragujev(?:ac|cu|ca)$/u.test(city)) return 'KRAGUJEVAC';
  return null;
};
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
const clauses = text => text.split(/\s*(?:[;.!?]+|,\s*(?:a|ali)\s+)\s*/iu)
  .flatMap(clause => {
    // A comma after a remote-only service can introduce an independent on-site
    // service. Keep ordinary comma-separated place lists intact.
    const comma = clause.indexOf(',');
    return comma >= 0 && remoteOnly.test(clause.slice(0, comma))
      ? [clause.slice(0, comma), clause.slice(comma + 1)] : [clause];
  }).map(clause => clause.trim()).filter(Boolean);
const withoutIdentityIntroduction = text => {
  if (!/^(?:zovem se|moje ime je|ime mi je|ja sam)\b/iu.test(text) &&
    !new RegExp(`^${namedPlace}\\s+i\\s+${namedPlace}\\s+rade\\s+sa\\s+mnom(?:,|$)`, 'u').test(text)) return text;
  const comma = text.indexOf(',');
  return comma < 0 ? '' : text.slice(comma + 1).trim();
};
const onSiteClauses = text => clauses(text).map(withoutIdentityIntroduction)
  .filter(clause => clause && !/^(?:živim|stanujem|prebivalište|adresa\s+(?:mi\s+)?je)\b/iu.test(clause)
    && !(remoteOnly.test(clause) && !onSiteWork.test(clause)));
const onSiteText = text => onSiteClauses(text).join('. ');
const remoteWithoutOnSiteArea = text => remoteOnly.test(text) && (remoteAreaOnly(text) || !onSiteText(text));
const samePlace = (one, other) => {
  const words = value => normalize(value).toLocaleLowerCase('sr').split(/\s+/u);
  const a = words(one), b = words(other);
  if (a.length !== b.length || !a[0] || !b[0]) return false;
  return a.every((word, index) => {
    const match = b[index];
    if (word === match) return true;
    let common = 0;
    while (common < Math.min(word.length, match.length) && word[common] === match[common]) common++;
    return common >= Math.max(3, Math.min(word.length, match.length) - 2);
  });
};
const statedSurroundingCity = text => {
  const value = normalize(text);
  return new RegExp(`(?:(${namedPlace})\\s+i\\s+[Oo]kolin[\\p{L}]*|[Oo]kolin[\\p{L}]*\\s+(?:grada\\s+)?(${namedPlace}))`, 'u').exec(value)?.slice(1).find(Boolean);
};
const statedCityByRadius = text => new RegExp(`(?:^|[^\\p{L}])(${namedPlace})\\s*,?\\s*(?:(?:i\\s+)?okolin[\\p{L}]*\\s+)?do\\s+\\d{1,3}\\s*(?:km|kilomet(?:ar|ra|ara|ri))(?=$|[^\\p{L}])`, 'u')
  .exec(normalize(text))?.[1];
const statedCityByWork = text => {
  const value = normalize(text);
  const prepositional = new RegExp(`(?:^|[^\\p{L}])(?:u|za|i\\s+u|takođe\\s+(?:u\\s+)?|dodaj(?:te)?\\s+(?:i\\s+)?(?:u\\s+)?|ubaci(?:te)?\\s+(?:i\\s+)?(?:u\\s+)?|proširi(?:te)?\\s+(?:i\\s+)?na\\s+)(${namedPlace})(?=$|[\\s,.;!?])`, 'iu').exec(value)?.[1];
  if (prepositional) return prepositional;
  return new RegExp(`^(${namedPlace})$`, 'u').exec(value)?.[1];
};
const statedRadius = text => {
  const value = normalize(text);
  const correctionShape = /(?:^|[^\p{L}])(?:nije|ne|umesto)\s+\d{1,3}\s*(km|kilomet(?:ar|ra|ara|ri))?\s*,?\s*(?:nego|već)\s+\d{1,3}\s*(km|kilomet(?:ar|ra|ara|ri))?(?=$|[^\p{L}])/iu.exec(value);
  if (correctionShape && (!correctionShape[1] || !correctionShape[2])) return 'AMBIGUOUS';
  const numbers = [...value.matchAll(/(?:^|[^\p{L}])(\d{1,3})\s*(?:km|kilomet(?:ar|ra|ara|ri))(?=$|[^\p{L}])/giu)]
    .map(match => Number(match[1]));
  // Without both units, the correction may refer to price or experience. It
  // still rejects the old number, so an area mutation needs clarification.
  if (!numbers.length) return null;
  if (numbers.every(number => number === numbers[0])) return numbers[0];
  const correction = /(?:^|[^\p{L}])(?:nije|ne|umesto)\s+\d{1,3}\s*(?:km|kilomet(?:ar|ra|ara|ri))\s*,?\s*(?:nego|već)\s+(\d{1,3})\s*(?:km|kilomet(?:ar|ra|ara|ri))(?=$|[^\p{L}])/iu.exec(value);
  return correction && numbers.at(-1) === Number(correction[1]) ? Number(correction[1]) : 'AMBIGUOUS';
};
const bioAreaClaim = text => broadScope.test(normalize(text)) || classifyWorkerAreaRequest(text) !== 'NONE';
const scrubAreaBio = text => text.split(/(?<=[.!?])\s+|[,;]\s*/u).map(part => part.trim())
  .filter(part => part && !bioAreaClaim(part) && !country.test(part) && !namedRegion.test(part))
  .map(part => `${part.replace(/[.!?]+$/u, '')}.`).join(' ');
const independentQuestions = message => (String(message).match(/[^.!?]{2,160}\?/gu) ?? [])
  .map(question => question.trim())
  .filter(question => !/(?:grad|područ|krug|km|kilomet|region|držav|okolin|srb|vojvodin)/iu.test(question))
  .slice(0, 1);

export function classifyWorkerAreaRequest(input) {
  const normalized = normalize(input);
  if (!normalized) return 'NONE';
  // A stated exclusion or a remote-only correction is not a request to add
  // on-site coverage. Let the ordinary service-mode conversation handle it.
  if (remoteWithoutOnSiteArea(normalized)) return 'NONE';
  const text = onSiteText(normalized);
  if (!text) return 'NONE';
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
  if (countryWork.test(text) || /^(?:srbija|srbije|srbiji|srbiju)$/iu.test(text)) return 'COUNTRY';
  if (namedRegion.test(text) && (text === namedRegion.exec(text)?.[0]?.trim() ||
    /(?:^|[^\p{L}])(?:radim|idem|dolazim|prihvatam|poslovi|područje|teren)\s+(?:po|u|na)\s+(?:celoj\s+)?(?:vojvodini|vojvodina|šumadiji|šumadija|balkanu|balkan)(?=$|[^\p{L}])/iu.test(text))) return 'REGION';
  if (/(?:^|[^\p{L}])(?:više|dva|tri|nekoliko)\s+gradova(?=$|[^\p{L}])/iu.test(text)) return 'MULTI_LOCALITY';
  if (cityDistancePair.test(text) || workCorridor.test(text) || routeCorridor.test(text)) return 'MULTI_LOCALITY';
  const lowerPair = knownCityPair.exec(text);
  if (lowerPair && knownCityId(lowerPair[1]) !== knownCityId(lowerPair[2])) return 'MULTI_LOCALITY';
  const joined = pair.exec(text), listed = commaPair.exec(text);
  if (joined && !areaCommandWords.has(joined[1].trim().toLocaleLowerCase('sr'))
    && !/^(?:Bosna|Bosni)$/iu.test(joined[1]) && !/^(?:Hercegovina|Hercegovini)$/iu.test(joined[2])
    && !country.test(joined[1]) && !country.test(joined[2])
    && !namedRegion.test(joined[1]) && !namedRegion.test(joined[2])) return 'MULTI_LOCALITY';
  if (listed && !areaCommandWords.has(listed[1].trim().toLocaleLowerCase('sr'))
    && !country.test(listed[1]) && !country.test(listed[2])
    && !namedRegion.test(listed[1]) && !namedRegion.test(listed[2])) return 'MULTI_LOCALITY';
  if (surroundings.test(text) && !distance.test(text)) return 'LOCALITY_NEEDS_DISTANCE';
  return 'NONE';
}

function statedWorkerCities(input) {
  const text = onSiteText(normalize(input));
  const CANONICAL_CITIES = { NOVI_SAD: 'Novi Sad', BEOGRAD: 'Beograd', NIS: 'Niš', KRAGUJEVAC: 'Kragujevac' };
  const STOP_WORDS = new Set([
    'radim', 'radimo', 'dolazim', 'dolazimo', 'idem', 'idemo', 'pokrivam', 'pokrivamo',
    'prihvatam', 'prihvatamo', 'nudim', 'nudimo', 'mogu', 'mozemo', 'možemo',
    ...areaCommandWords,
    'takodje', 'takođe', 'grad', 'gradovi', 'gradove', 'gradovima', 'podrucje', 'područje',
    'teren', 'lokacija', 'lokacije', 'sve', 'svi', 'ja', 'mi', 'samo', 'vise', 'više'
  ]);
  const toNominative = name => {
    const cid = knownCityId(name);
    if (cid && CANONICAL_CITIES[cid]) return CANONICAL_CITIES[cid];
    if (/ici$/iu.test(name)) return name.replace(/ici$/iu, 'ica');
    if (/di$/iu.test(name)) return name.replace(/di$/iu, 'da');
    if (/inu$/iu.test(name)) return name.replace(/u$/iu, '');
    if (/evcu$/iu.test(name)) return name.replace(/evcu$/iu, 'evac');
    if (/ovcu$/iu.test(name)) return name.replace(/ovcu$/iu, 'ovac');
    if (/(?:evu|ovu)$/iu.test(name)) return name.replace(/u$/iu, 'o');
    if (/u$/iu.test(name) && !/(?:valjev|pancev|kraljev|vranj)/iu.test(name)) return name.replace(/u$/iu, '');
    return name;
  };
  const cities = [];
  const seen = new Set();
  const addCity = name => {
    const clean = String(name || '').trim();
    const lower = clean.toLocaleLowerCase('sr');
    if (!clean || clean.length < 2 || STOP_WORDS.has(lower) || country.test(clean) || namedRegion.test(clean)) return;
    const canonical = toNominative(clean);
    const cid = knownCityId(canonical) || knownCityId(clean);
    const key = cid || canonical.toLocaleLowerCase('sr');
    if (!seen.has(key)) {
      seen.add(key);
      cities.push(canonical);
    }
  };
  for (const match of text.matchAll(new RegExp(knownCity, 'giu'))) addCity(match[0]);
  for (const match of text.matchAll(new RegExp(`(?:^|[\\s,;])(?:u\\s+)?(${namedPlace})`, 'gu'))) {
    if (match[1]) addCity(match[1]);
  }
  return { text, cities };
}

/** Pure, post-provider guard. All returned patches still pass the DB validator. */
export function guardWorkerAreaOutput(output, userText, context) {
  // REVIEW/BLOCK intentionally freeze the DB candidate. Never downgrade them
  // to CLARIFY, which would make an otherwise ignored patch writable.
  if (!['ALLOW', 'CLARIFY'].includes(output.safety)) return output;
  // Owner, 23.11.2026: Gemini understands where the person works and sends the complete area list (areaRequests).
  // The server never builds or corrects areas from the person's words; the resolver checks every entry (a known
  // region code, a real place in Serbia, a distance of 1–200 km) and asks when a place cannot be found.
  const patch = { ...output.patch };
  // The legacy single location is never written next to the area list.
  delete patch.location;
  const requests = Array.isArray(patch.areaRequests) ? patch.areaRequests : null;
  if (requests && requests.length > WORKER_AREA_LIMIT) {
    delete patch.areaRequests;
    if (typeof patch.bio === 'string' && bioAreaClaim(patch.bio)) delete patch.bio;
    return { ...output, safety: 'CLARIFY', patch,
      assistantMessage: `Profil može da sadrži najviše ${WORKER_AREA_LIMIT} mesta. Možete navesti i celu regiju, na primer celu Vojvodinu. Koja mesta želite da zadržite?` };
  }
  // Provenance of a distance: the kilometres were said in this message or are already in the owned area.
  const owned = Array.isArray(context?.candidate?.workAreas) ? context.candidate.workAreas : [];
  const saidNumber = value => new RegExp(`(?:^|[^\\p{N}])${value}(?=$|[^\\p{N}])`, 'u').test(String(userText ?? ''));
  const unsourcedRadius = requests?.some(area => area?.kind === 'RADIUS' && Number.isInteger(area.radiusKm)
    && !saidNumber(area.radiusKm)
    && !owned.some(own => own?.kind === 'RADIUS' && own.radiusKm === area.radiusKm && samePlace(own.city, area.query)));
  if (unsourcedRadius) {
    delete patch.areaRequests;
    return { ...output, safety: 'CLARIFY', patch,
      assistantMessage: 'Do koliko kilometara Vam odgovara da putujete?' };
  }
  // Areas live only in the area list. A bio sentence of Gemini's that claims an area is left out of the bio;
  // unchanged sentences the person already owns stay as they are.
  if (typeof patch.bio === 'string') {
    const ownedBio = typeof context?.candidate?.bio === 'string'
      ? new Set(context.candidate.bio.trim().split(/(?<=[.!?])\s+/u)) : new Set();
    const sentences = patch.bio.trim().split(/(?<=[.!?])\s+/u);
    if (sentences.some(sentence => !ownedBio.has(sentence) && bioAreaClaim(sentence))) {
      const safeBio = sentences.map(sentence => ownedBio.has(sentence) ? sentence : scrubAreaBio(sentence)).filter(Boolean).join(' ');
      if (safeBio) patch.bio = safeBio; else delete patch.bio;
    }
  }
  return { ...output, patch };
}
