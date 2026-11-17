// One structured decision from the existing interview call. It is a proposal
// for the current turn, never navigation, publication, profile Save or consent.
export const INTERVIEW_INTENT_HEADER = 'x-uskoci-interview-intent';
export const INTERVIEW_INTENT_CAPABILITY = 'v1';
export const INTERVIEW_INTENT_SCHEMA = 'AI_CONVERSATION_INTENT_V1';
export const CONVERSATION_INTENT_KINDS = [
  'NEED_REQUEST', 'NEED_EDIT', 'WORKER_OFFER', 'WORKER_ADD_SERVICE',
  'WORKER_REMOVE_SERVICE', 'WORKER_EDIT_SERVICE', 'WORKER_AVAILABILITY',
  'WORKER_AREA', 'CORRECTION', 'CONTINUE', 'QUESTION', 'MIXED', 'UNCLEAR',
];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const safeText = (value, max) => typeof value === 'string' && value.length <= max
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const quoteText = value => value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
const foldSameScript = value => value.normalize('NFKC').toLowerCase()
  .replace(/[čć]/gu, 'c').replace(/š/gu, 's').replace(/ž/gu, 'z').replace(/đ/gu, 'dj')
  .replace(/[.,!?;:"„”«»()]/gu, ' ').replace(/\s+/gu, ' ').trim();
const currentQuote = (evidence, currentText) => safeText(evidence, 500) && !!evidence.trim()
  && typeof currentText === 'string'
  && (quoteText(currentText).includes(quoteText(evidence))
    || (!!foldSameScript(evidence) && foldSameScript(currentText).includes(foldSameScript(evidence))));
const ROLE_CYRILLIC = {
  а:'a', б:'b', в:'v', г:'g', д:'d', ђ:'dj', е:'e', ж:'z', з:'z', и:'i', ј:'j',
  к:'k', л:'l', љ:'lj', м:'m', н:'n', њ:'nj', о:'o', п:'p', р:'r', с:'s', т:'t',
  ћ:'c', у:'u', ф:'f', х:'h', ц:'c', ч:'c', џ:'dz', ш:'s',
};
const normalizeRoleText = value => Array.from(value.toLocaleLowerCase('sr'), char => ROLE_CYRILLIC[char] ?? char).join('')
  .replace(/đ/g, 'dj').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const withoutQuotedRoleText = value => value.replace(/„[^“]*“|“[^”]*”|«[^»]*»|"[^"]*"/gu, ' ');
const ROLE_QUESTION = /(?:^| )(?:da li|je li|jel|kako|gde|sta|zasto|mogu li|smem li|treba li|trebaju li)(?: |$)/;
const ROLE_OFFER_PREDICATE = 'nudim|pruzam|pozelim da ponudim|zelim da (?:nudim|ponudim|pruzam|radim|se bavim)|hocu da (?:nudim|ponudim|pruzam|radim|se bavim)|(?:hteo|htela|zeleo|zelela|voleo|volela) bih da (?:nudim|ponudim|radim)|ja mogu da (?:radim|pruzam|pomognem)|radim kao|bavim se|drzim (?:privatne |online |onlajn )?casove|dajem (?:privatne )?casove';
const ROLE_POSITIVE_OFFER = new RegExp('(?:^| )(?:' + ROLE_OFFER_PREDICATE + ')(?: |$)');
const ROLE_NEGATED_OFFER = new RegExp('(?:^| )(?:ne|nisam|necu(?: da)?) (?:' + ROLE_OFFER_PREDICATE + ')(?: |$)');
const ROLE_NEED_REQUEST_PREDICATE = 'treba mi (?:neko|nekoga|nekome|covek|coveka|osoba|osobu|ekipa|ljudi|pomoc|majstor|majstora|radnik|radnika|prevoz|kombi|selidba|utovar)|meni treba (?:neko|nekoga|covek|coveka|majstor|majstora|radnik|radnika|pomoc|prevoz)|potreban mi je (?:neko|majstor|radnik|pomocnik)|potrebna mi je (?:pomoc|osoba|majstor|usluga)|potrebno mi je (?:neko|pomoc|vozilo|prevoz)|potrebni su mi (?:ljudi|radnici|majstori|pomocnici)|trazim (?:nekog|nekoga|majstora|radnika|pomoc|prevoz)|neko da mi|da mi neko|zelim da mi neko|hocu da mi neko|potrebno (?:je )?\\d+ (?:ljudi|osoba|radnika|majstora|pomocnika)|trebaju mi (?:dva|tri|cetiri|pet|sest|sedam|osam|devet|deset|nekoliko|par) (?:coveka|ljudi|osoba|radnika|majstora|pomocnika)';
const ROLE_NEED_REQUEST = new RegExp('(?:^| )(?:' + ROLE_NEED_REQUEST_PREDICATE + ')(?: |$)');
const ROLE_NEGATED_NEED = /(?:^| )(?:ne|nikako) (?:treba mi|meni treba|potreban mi je|potrebna mi je|potrebno mi je|potrebni su mi|trazim|trebaju mi)(?: |$)/;
function explicitWorkerOffer(text) {
  if (!safeText(text, 4000) || !text.trim()) return false;
  const unquoted = withoutQuotedRoleText(text);
  const normalized = normalizeRoleText(unquoted);
  if (!normalized || /[?？]/u.test(unquoted) || ROLE_QUESTION.test(normalized) || ROLE_NEGATED_OFFER.test(normalized)) return false;
  return ROLE_POSITIVE_OFFER.test(normalized);
}
function explicitNeedRequest(text) {
  if (!safeText(text, 4000) || !text.trim()) return false;
  const unquoted = withoutQuotedRoleText(text);
  const normalized = normalizeRoleText(unquoted);
  if (!normalized || /[?？]/u.test(unquoted) || ROLE_QUESTION.test(normalized) || ROLE_NEGATED_NEED.test(normalized)) return false;
  return ROLE_NEED_REQUEST.test(normalized);
}
function explicitRoleSignal(text) {
  if (typeof text !== 'string') return null;
  const worker = explicitWorkerOffer(text), need = explicitNeedRequest(text);
  if (worker && need) return 'MIXED';
  if (worker) return 'WORKER';
  if (need) return 'NEED';
  return null;
}
const skillLabel = value => safeText(value, 120) && value.trim().length >= 3 && !/[<>\u0000-\u001f]/u.test(value);
// Preserve a useful local clarification, without retaining a prefixed claim
// of Save/publication/navigation. This is formatting admission, not an intent
// classifier; the structured decision still freezes all proposed writes.
export function clarificationQuestion(value) {
  if (!safeText(value, 500)) return null;
  const match = value.trim().match(/(?:^|[.!]\s+)([^.!?]+\?)$/u);
  const question = match?.[1]?.trim();
  if (!question || /(?:sačuv|sacuv|objav|aktivir|prebac|preusmer|сачув|објав|активир|пребац|преусмер)/iu.test(question)) return null;
  return question;
}

export function withConversationIntentSchema(schema) {
  return { ...schema, properties: {
    conversationIntent: { type: 'OBJECT', additionalProperties: false,
      properties: { kind: { type: 'STRING', enum: CONVERSATION_INTENT_KINDS }, evidence: { type: 'STRING' } },
      required: ['kind', 'evidence'] },
    ...schema.properties,
  }, required: [...(schema.required ?? []), 'conversationIntent'] };
}


export function takeConversationIntent(value, currentText) {
  if (!record(value)) return { output: value, intent: { kind: 'UNCLEAR', evidence: '' }, valid: false };
  const { conversationIntent, ...output } = value;
  const valid = exact(conversationIntent, ['kind', 'evidence'])
    && CONVERSATION_INTENT_KINDS.includes(conversationIntent.kind)
    && safeText(conversationIntent.evidence, 500)
    && (currentQuote(conversationIntent.evidence, currentText)
      || ['CONTINUE', 'UNCLEAR'].includes(conversationIntent.kind) && conversationIntent.evidence === '');
  return { output, intent: valid ? { ...conversationIntent } : { kind: 'UNCLEAR', evidence: '' }, valid };
}

export function intentAllowsDomain(decision, domain, currentText) {
  if (!decision?.valid) return false;
  const roleSignal = explicitRoleSignal(currentText);
  if (roleSignal === 'MIXED' || roleSignal && roleSignal !== domain) return false;
  const kind = decision.intent.kind;
  return ['CONTINUE', 'CORRECTION'].includes(kind)
    || domain === 'NEED' && kind.startsWith('NEED_')
    || domain === 'WORKER' && kind.startsWith('WORKER_');
}

/** Remove proposed writes before the ordinary strict field parsers/writers. */
export function guardInterviewIntentOutput(value, decision, domain, currentText) {
  if (!record(value) || !['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(value.safety)) return value;
  const safetyHold = ['REVIEW', 'BLOCK'].includes(value.safety);
  if (!safetyHold && intentAllowsDomain(decision, domain, currentText)) return value;
  const kind = decision.intent.kind;
  const roleSignal = explicitRoleSignal(currentText);
  let assistantMessage = value.assistantMessage;
  if (!safetyHold && kind !== 'QUESTION') {
    assistantMessage = roleSignal === 'MIXED'
      ? 'Da li sada želite da objavite zadatak ili da uredite ponudu svojih usluga?'
      : roleSignal === 'WORKER' && domain === 'NEED'
        ? 'Za ponudu svojih usluga otvorite „Uskoči i zaradi“. Otvoriće se nov, prazan razgovor; ova poruka se neće preneti niti poslati.'
        : roleSignal === 'NEED' && domain === 'WORKER'
          ? 'Za objavu zadatka otvorite „Objavi zadatak“. Otvoriće se nov, prazan razgovor; ova poruka se neće preneti niti poslati.'
          : kind.startsWith('WORKER_') && domain === 'NEED'
            ? 'Razumem. Želite da ponudite svoje usluge. Otvorite „Uskoči i zaradi“; ova poruka se neće preneti u novi razgovor.'
            : kind.startsWith('NEED_') && domain === 'WORKER'
              ? 'Razumem. Želite da pronađete nekoga za zadatak. Otvorite „Objavi zadatak“; ova poruka se neće preneti u novi razgovor.'
              : kind === 'UNCLEAR' && decision.valid
                ? clarificationQuestion(value.assistantMessage) || 'Šta biste želeli da promenite ili razjasnite?'
                : 'Želite li sada da objavite zadatak ili da uredite ponudu svojih usluga?';
  }
  const safety = safetyHold ? value.safety : kind === 'QUESTION' || kind.startsWith('NEED_') || kind.startsWith('WORKER_') ? value.safety : 'CLARIFY';
  if (domain === 'WORKER') return { ...value, safety, assistantMessage, patch: { availability: null },
    availabilityChange: { kind: 'NONE', evidence: '' }, serviceChanges: [],
    ...(Object.hasOwn(value, 'serviceModeChangesJson') ? { serviceModeChangesJson: '[]' } : {}),
    ...(Object.hasOwn(value, 'taxonomyDecisions') ? { taxonomyDecisions: [] } : {}) };
  return { ...value, safety, assistantMessage, facts: [],
    ...(Object.hasOwn(value, 'taxonomyDecisions') ? { taxonomyDecisions: [] } : {}),
    dialogue: { next: kind === 'QUESTION' || kind.startsWith('WORKER_') ? 'ANSWER' : 'CLARIFY',
      questionKey: 'NONE', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
    ...(Object.hasOwn(value, 'locationDecision') ? { locationDecision: { action: 'CONTINUE', proposalId: 'NONE',
      explicitConfirmation: false, hasCorrection: false, hasUncertainty: false } } : {}) };
}

/** Attach only to an opted-in final event after the exact SQL receipt succeeds. */
export function conversationIntentHint(decision, safety) {
  return decision?.valid && ['ALLOW', 'CLARIFY'].includes(safety)
    ? { schemaVersion: INTERVIEW_INTENT_SCHEMA, ...decision.intent } : null;
}

export const workerServiceChangesSchema = { type: 'ARRAY', maxItems: 24, items: {
  type: 'OBJECT', additionalProperties: false, required: ['action', 'service', 'replacement', 'evidence'], properties: {
    action: { type: 'STRING', enum: ['ADD', 'REMOVE', 'REPLACE'] }, service: { type: 'STRING' },
    replacement: { type: 'STRING' }, evidence: { type: 'STRING' },
  },
} };

export function workerServiceChangesInstruction() {
  return 'serviceChanges is the ONLY provider plan for changing services; NEVER output patch.skills. Return [] when unchanged. '
    + 'Each item is {action,service,replacement,evidence}. ADD: service=new concrete offered work, replacement="". REMOVE: service=EXACT existing candidate.skills label, replacement="". REPLACE: service=EXACT old label, replacement=new corrected work/scope. Every operation cites verbatim CURRENT USER evidence (1–500 characters). No duplicate/conflicting targets, renaming for style or speculative service suggestions. The server applies only these edits to the existing complete list; unmentioned services remain unchanged. '
    + '“Takođe popravljam slavine”, “Sada radim i prevode”, “Додај и кошење траве” ADD the clearly offered service while retaining others. “Više ne radim selidbe” REMOVE only the identified existing moving service. “Prevoz radim, ali utovar više ne” keeps transport and removes only an identified loading service; if loading is part of a combined service, use REPLACE to retain its still-offered parts or ask if scope is unclear. A negative capability is never an ADD. '
    + '“Mogu da nosim nameštaj, nemam kombi” offers physical moving help, not transport. “Imam kombi, ali ne radim utovar” does not by itself authorize adding every transport service. Initial concrete offers use ADD; knowledge, possessions, examples, questions, a different person’s skills, unclear removals and unsupported corrections use no service operation. Related service suggestions need explicit current-user agreement in the owned conversation. Existing availability/area/mode contracts remain separate.';
}

/** Translate a quoted mutation plan into the existing writer's complete list. */
export function applyWorkerServiceChanges(output, changes, candidate, currentText, decision) {
  if (!intentAllowsDomain(decision, 'WORKER', currentText) || !['ALLOW', 'CLARIFY'].includes(output.safety)) return { output, valid: true };
  const base = candidate?.skills;
  const { skills: providerSkills, ...independent } = output.patch;
  const kind = decision.intent.kind;
  const serviceMutation = ['WORKER_OFFER', 'WORKER_ADD_SERVICE', 'WORKER_REMOVE_SERVICE', 'WORKER_EDIT_SERVICE'].includes(kind);
  const rejected = () => {
    // A biography may already claim the rejected service edit. Keep its prior
    // version together with the prior services; unrelated valid fields survive.
    const { bio: _unconfirmedBio, ...patch } = independent;
    const assistantMessage = ['WORKER_OFFER', 'WORKER_ADD_SERVICE'].includes(kind)
      ? 'Koju konkretnu uslugu želite da ponudite?'
      : 'Koju uslugu želite da promenite ili uklonite?';
    return { valid: false, output: { ...output, safety: 'CLARIFY', patch, assistantMessage } };
  };
  if (!Array.isArray(base) || base.length > 50 || base.some(service => typeof service !== 'string')
      || !Array.isArray(changes) || changes.length > 24) return rejected();
  // Old or malformed provider output must not bypass the explicit change plan.
  if (providerSkills !== undefined) return rejected();
  if (!changes.length) return serviceMutation ? rejected() : { output, valid: true };

  if (['WORKER_AVAILABILITY', 'WORKER_AREA'].includes(kind)) return rejected();
  const next = [...base], touched = new Set();
  const findSkillIndex = (list, target) => {
    const exactIdx = list.indexOf(target);
    if (exactIdx >= 0) return exactIdx;
    const foldedTarget = foldSameScript(target);
    return foldedTarget ? list.findIndex(item => foldSameScript(item) === foldedTarget) : -1;
  };
  for (const change of changes) {
    if (!exact(change, ['action', 'service', 'replacement', 'evidence'])
        || !['ADD', 'REMOVE', 'REPLACE'].includes(change.action) || !skillLabel(change.service)
        || !currentQuote(change.evidence, currentText) || touched.has(change.service)
        || kind === 'WORKER_ADD_SERVICE' && change.action !== 'ADD'
        || kind === 'WORKER_REMOVE_SERVICE' && change.action !== 'REMOVE') return rejected();
    touched.add(change.service);
    if (change.action === 'ADD') {
      if (change.replacement !== '') return rejected();
      if (findSkillIndex(next, change.service) < 0) next.push(change.service);
    } else {
      const index = findSkillIndex(base, change.service), current = findSkillIndex(next, change.service);
      if (index < 0 || current < 0) return rejected();
      if (change.action === 'REMOVE') {
        if (change.replacement !== '') return rejected();
        next.splice(current, 1);
      } else {
        if (!skillLabel(change.replacement) || findSkillIndex(next, change.replacement) >= 0 || touched.has(change.replacement)) return rejected();
        next[current] = change.replacement;
        touched.add(change.replacement);
      }
    }
  }
  if (next.length > 50 || new Set(next).size !== next.length) return rejected();
  return { valid: true, output: { ...output, patch: { ...independent, skills: next } } };
}
