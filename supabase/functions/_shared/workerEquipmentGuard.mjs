// Guard provider acknowledgements against the canonical WORKER biography.
// This is deliberately narrow: it validates only explicit equipment add/remove claims.
const equipmentNoun = '(?:kombi(?:ja|jem|ju)?|vozil(?:o|a|u|om|ima)|auto(?:mobil(?:a|u|om)?|m|u|a)?|kamion(?:a|u|om)?|prikolic(?:a|u|e|om)|alat(?:a|e|i|om)?|busilic(?:a|u|e|om)|kolic(?:a|ima)|merdevin(?:e|a|ama)|tester(?:a|u|e|om)|masin(?:a|u|e|om)|bicikl(?:a|u|om)?|skuter(?:a|u|om)?)';
const equipmentDraftAcknowledgement = new RegExp(`(?:^|[.!]\\\\s+)(?:(?:novi|nova|novo|moj|moja|moje)\\\\s+)?(${equipmentNoun})\\\\s+(?:je\\\\s+)?(dodat|dodata|dodato|zabelezen|zabelezena|zabelezeno|upisan|upisana|upisano|unet|uneta|uneto|uklonjen|uklonjena|uklonjeno|obrisan|obrisana|obrisano)\\\\s+(?:u|iz)\\\\s+(?:nacrt(?:a)?|opis(?:a)?|profil(?:a)?)(?=[.!]|$|\\\\s)`, 'u');
const cyrillicEquipmentLetters = Object.fromEntries([
  ['а','a'],['б','b'],['в','v'],['г','g'],['д','d'],['ђ','dj'],['е','e'],['ж','z'],['з','z'],['и','i'],['ј','j'],
  ['к','k'],['л','l'],['љ','lj'],['м','m'],['н','n'],['њ','nj'],['о','o'],['п','p'],['р','r'],['с','s'],['т','t'],
  ['ћ','c'],['у','u'],['ф','f'],['х','h'],['ц','c'],['ч','c'],['џ','dz'],['ш','s'],
]);
function normalizeEquipmentText(value) {
  return String(value ?? '').toLocaleLowerCase('sr').replace(/[\\u0400-\\u04ff]/gu, letter => cyrillicEquipmentLetters[letter] ?? letter)
    .normalize('NFKD').replace(/\\p{M}/gu,'').replace(/\\s+/gu,' ').trim();
}
function containsEquipmentFact(bio, noun) {
  const normalized = normalizeEquipmentText(bio);
  return new RegExp('(?:^|[^\\\\p{L}])' + noun.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '(?=$|[^\\\\p{L}])', 'u').test(normalized);
}

export function guardWorkerEquipmentOutput(output, candidate) {
  const patch = output.patch;
  const legacy = Object.hasOwn(patch,'tools') || Object.hasOwn(patch,'vehicles');
  const acknowledgement = equipmentDraftAcknowledgement.exec(normalizeEquipmentText(output.assistantMessage));
  let unrecorded = false;
  if (acknowledgement) {
    const [, noun, verb] = acknowledgement;
    const removal = /^(?:uklonjen|uklonjena|uklonjeno|obrisan|obrisana|obrisano)$/u.test(verb);
    const oldBioContains = containsEquipmentFact(candidate.bio, noun);
    const nextBioContains = Object.hasOwn(patch, 'bio')
      ? containsEquipmentFact(patch.bio, noun)
      : oldBioContains;
    unrecorded = removal
      ? !oldBioContains || !Object.hasOwn(patch, 'bio') || nextBioContains
      : !nextBioContains;
  }
  if (!legacy && !unrecorded) return output;
  const {tools: _tools,vehicles: _vehicles,...safePatch}=patch;
  if (output.safety==='REVIEW' || output.safety==='BLOCK') return {...output,patch:safePatch};
  return {...output,patch:safePatch,assistantMessage:
    'Izmena alata ili vozila nije zabeležena u opisu profila. '+
    (Object.keys(safePatch).length ? 'Ostale jasne izmene su u nacrtu.' : 'Možete da dopunite opis kroz razgovor.')};
}
