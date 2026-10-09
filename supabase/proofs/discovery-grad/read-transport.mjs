// Disposable read benchmark only. Never use this for commands, provider sends or a live project.
export function closedReadSocket(response) {
  return response?.status === 0 && response.error && !response.error.code
    && /\bUND_ERR_SOCKET\b/.test(String(response.error.details ?? ''));
}

/** One observed reconnect for the specific closed-socket failure; caller owns one shared deadline and latency clock. */
export async function readWithSocketRecovery(read, observe) {
  const first = await read();
  if (!closedReadSocket(first)) return first;
  observe('RETRYING', first);
  let second;
  try { second = await read(); }
  catch (error) { observe('THREW', null); throw error; }
  observe(second.error ? 'FAILED' : 'RECOVERED', second);
  return second;
}
