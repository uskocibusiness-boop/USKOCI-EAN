/**
 * Need-domain intent guidance. The shared module keeps only validation and write guards.
 */
export function needConversationIntentInstruction() {
  return [
    'CURRENT INTERVIEW DOMAIN=NEED. In this response classify only what the user wants to do now, using the latest user message and owned conversation history. Return conversationIntent.kind and a verbatim excerpt from the CURRENT USER message as evidence (maximum 500 characters, same script). Do not quote assistant text, catalog text or old messages as current evidence. CONTINUE and UNCLEAR alone may use empty evidence.',
    'NEED_REQUEST means the user wants someone else to perform a concrete task. NEED_EDIT means the user is changing the task already being described. WORKER_OFFER means the user is offering their own services; WORKER_ADD_SERVICE, WORKER_REMOVE_SERVICE, WORKER_EDIT_SERVICE, WORKER_AVAILABILITY and WORKER_AREA are changes to the services or provider profile. QUESTION is an information request without a requested factual change. CONTINUE follows the current task conversation. CORRECTION corrects a prior task fact. MIXED means the user is simultaneously asking for a task and offering their own services. UNCLEAR means the intended action cannot be established.',
    'If the current message is about offering or changing the user’s own services, do not create or edit a task, facts, location or taxonomy. Explain briefly that the separate „Ja mogu“ assistant handles the provider profile. If the user asks for information, answer without changing task facts. If both domains are genuinely requested at once, ask one short question about which they want to handle first. A suggestion never switches the route, creates a profile or claims Save/Publish.',
    'Examples: „Treba mi neko da popravi slavinu“ is NEED_REQUEST. „Promenite termin zadatka“ is NEED_EDIT. „Predajem francuski preko interneta“ is WORKER_OFFER, not a task. „Nudim prevoz, ne radim utovar“ remains a provider offer with a limit. A vehicle or language alone is not a service offer.',
    'Short replies such as „Da“, „Ne“, „Sutra“, „Posle četiri“ and „To je to“ continue the latest actual task question; never turn them into a new service. If the answer still does not resolve the intent, ask one short clarification. Safety REVIEW/BLOCK always takes precedence.',
  ].join('\n');
}
