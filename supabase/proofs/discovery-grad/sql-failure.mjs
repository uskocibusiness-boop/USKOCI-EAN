// Bounded SQL diagnostics: never emit argv, connection strings, stdout or environment.
export function sqlFailure(error, elapsedMs) {
  const stderr = String(error?.stderr ?? '');
  const lines = stderr.split(/\r?\n/);
  const headline = lines.find(line => /(?:^|\s)(?:ERROR|FATAL):/.test(line)) ?? '';
  const markers = lines.filter(line => line.includes('AREA_PROBE:'));
  const processCode = ['ENOBUFS', 'ENOENT', 'ETIMEDOUT'].includes(error?.code) ? error.code : null;
  return {ok: false, timedOut: /statement timeout|canceling statement/i.test(stderr) || processCode === 'ETIMEDOUT',
    elapsedMs, status: Number.isInteger(error?.status) ? error.status : null,
    signal: ['SIGTERM', 'SIGKILL', 'SIGINT'].includes(error?.signal) ? error.signal : null, processCode,
    error: headline.slice(0, 700) || (processCode ?? 'SQL_PROCESS_FAILED'),
    diagnostic: {headline: headline.slice(0, 700), lastProbe: markers.at(-1)?.slice(0, 200) ?? null,
      stderrStart: stderr.slice(0, 1200), stderrEnd: stderr.slice(-700)}};
}
