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

export function intentAllowsDomain(decision, domain) {
  if (!decision?.valid) return false;
  const kind = decision.intent.kind;
  return ['CONTINUE', 'CORRECTION'].includes(kind)
    || domain === 'NEED' && kind.startsWith('NEED_')
    || domain === 'WORKER' && kind.startsWith('WORKER_');
}

/** Remove proposed writes before the ordinary strict field parsers/writers. */
export function guardInterviewIntentOutput(value, decision, domain) {
  if (!record(value) || !['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(value.safety)) return value;
  const safetyHold = ['REVIEW', 'BLOCK'].includes(value.safety);
  if (!safetyHold && intentAllowsDomain(decision, domain)) return value;
  const kind = decision.intent.kind;
  let assistantMessage = value.assistantMessage;
  if (!safetyHold && kind !== 'QUESTION') {
    assistantMessage = kind.startsWith('WORKER_') && domain === 'NEED'
      ? 'Razumem. Želite da ponudite svoje usluge. Za to je namenjen AI asistent za radni profil. Možete nastaviti sa njim.'
      : kind.startsWith('NEED_') && domain === 'WORKER'
        ? 'Razumem. Želite da pronađete nekoga za zadatak. Za to je namenjen AI asistent za novi zadatak. Možete nastaviti sa njim.'
        : kind === 'UNCLEAR' && decision.valid
          ? clarificationQuestion(value.assistantMessage) || 'Šta biste želeli da promenite ili razjasnite?'
          : 'Želite li sada da pronađete pomoć za zadatak ili da uredite usluge koje nudite?';
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
  if (!intentAllowsDomain(decision, 'WORKER') || !['ALLOW', 'CLARIFY'].includes(output.safety)) return { output, valid: true };
  const base = candidate?.skills;
  const { skills: providerSkills, ...independent } = output.patch;
  const rejected = () => {
    // A biography may already claim the rejected service edit. Keep its prior
    // version together with the prior services; unrelated valid fields survive.
    const { bio: _unconfirmedBio, ...patch } = independent;
    return { valid: false, output: { ...output, safety: 'CLARIFY', patch,
      assistantMessage: 'Koju uslugu želite da dodate, promenite ili uklonite? Ostale usluge ostaju u nacrtu.' } };
  };
  if (!Array.isArray(base) || base.length > 50 || base.some(service => typeof service !== 'string')
      || !Array.isArray(changes) || changes.length > 24) return rejected();
  // Old or malformed provider output must not bypass the explicit change plan.
  if (providerSkills !== undefined) return rejected();
  if (!changes.length) return { output, valid: true };
  const kind = decision.intent.kind;
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
