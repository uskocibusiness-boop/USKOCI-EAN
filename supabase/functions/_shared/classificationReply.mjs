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
  // A rejected REVIEW transition cannot retain the model's invitation to
  // publish. Facts remain in the live draft; the server's actionable state wins.
  if (finishOnly || turn.dialogue?.next === 'REVIEW') assistantMessage = next;
  // Existing substantive questions stay first. On an ordinary answer, add the
  // missing question or honest processing state without restarting the intake.
  else if (!assistantMessage.includes('?') &&
      !assistantMessage.includes(next) && assistantMessage.length + next.length + 2 <= maximum)
    assistantMessage += '\n\n' + next;
  return { ...turn, assistantMessage,
    ...(turn.dialogue?.next === 'REVIEW' ? {
      dialogue: { ...turn.dialogue, next: questions.length ? 'CLARIFY' : 'ACK',
        questionKey: '' },
    } : {}),
  };
}
