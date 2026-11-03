// Conversational feedback is advisory. It cannot save, classify or dispatch.
// Keep the person's answer and independent facts; a finish acknowledgement has
// no substantive answer to lose and can give the exact next question instead.
export function withClassificationFeedback(turn, feedback, { finishOnly = false, maximum = 1200 } = {}) {
  if (!feedback || !['ALLOW','CLARIFY'].includes(turn?.safety) ||
      feedback.canOfferReview || feedback.state === 'CLEAR') return turn;
  const questions = feedback.questions ?? [];
  const next = questions.length ? questions.join(' ') : feedback.notice;
  if (!next) return turn;
  let assistantMessage = turn.assistantMessage;
  const proposedReview = turn.dialogue?.next === 'REVIEW';
  const isUserQuestion = feedback.state === 'ASK_USER' && (
    assistantMessage.includes('?') ||
    // A natural question may be deliberately written without "?"; the owned
    // structured dialogue next is stronger than punctuation counting.
    turn.dialogue?.next === 'ASK' || turn.dialogue?.next === 'CLARIFY');
  const isAnsweringUser = feedback.state === 'ASK_USER' && turn.dialogue?.next === 'ANSWER';
  let addedQuestion = false;
  // A rejected REVIEW transition cannot retain the model's invitation to
  // publish. Facts remain in the live draft; the server's actionable state wins.
  if (finishOnly || proposedReview) {
    assistantMessage = next;
    addedQuestion = questions.length > 0;
  }
  // Existing single questions and explanations stay first. Never append a
  // second classification question simply because the model omitted "?".
  else if (!isUserQuestion && !isAnsweringUser &&
      !assistantMessage.includes(next) && assistantMessage.length + next.length + 2 <= maximum) {
    assistantMessage += '\n\n' + next;
    addedQuestion = questions.length > 0;
  }
  return { ...turn, assistantMessage,
    ...(turn.dialogue && (proposedReview || addedQuestion) ? {
      dialogue: { ...turn.dialogue,
        next: addedQuestion ? 'CLARIFY' : 'ACK',
        questionKey: '' },
    } : {}),
  };
}
