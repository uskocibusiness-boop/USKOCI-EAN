import { ARCHIVE_FILTERS, DRAFTS_NOT_KEPT, EMPTY_ARCHIVE, REASON_NOT_KEPT, archiveEntries, archiveGroups, filterArchive, hasUnkeptReason,
  type ArchiveEntry } from '../archive';
import { NO_POSAO, agreementOf, applicationOf, needOf } from './fixtures';

// "Arhiva": what is over, for both sides, read-only. Only what the reads say: a closed task and a closed application keep no reason.
// The fixtures are the finished ones: a finished Dogovor with its term in words, a closed task, a closed application.
const agreement = (id: string, patch: Parameters<typeof agreementOf>[1] = {}) => agreementOf(id, { stanje: 'COMPLETED', vremeTekst: '24. sep · 12:00–19:00', ...patch });
const need = (id: string, patch: Parameters<typeof needOf>[1] = {}) => needOf(id, { stanje: 'ZATVORENA', vremeTekst: '10. sep · 09:00–12:00', ...patch });
const application = (id: string, patch: Parameters<typeof applicationOf>[1] = {}) => applicationOf(id, { stanje: 'CLOSED', ...patch });
const keys = (entries: readonly ArchiveEntry[]) => entries.map(entry => entry.key);

describe('what the archive keeps', () => {
  const all = archiveEntries({
    agreements: [agreement('done'), agreement('gone', { stanje: 'CANCELLED' }), agreement('live', { stanje: 'CONFIRMED' }), agreement('wait', { stanje: 'AWAITING_REQUESTER' })],
    needs: [need('closed'), need('open', { stanje: 'OBJAVLJENA' }), need('draft', { stanje: 'NACRT' }), need('filled', { stanje: 'POPUNJENA' })],
    applications: [application('closed'), application('back', { stanje: 'WITHDRAWN' }), application('sent', { stanje: 'SUBMITTED' }),
      application('picked', { stanje: 'SELECTED' }), application('seen', { stanje: 'VIEWED' }), application('stale', { stanje: 'STALE_REVIEW_REQUIRED' })],
  });
  it('is the finished and cancelled Dogovori, the closed tasks, and the withdrawn and closed applications, and nothing live', () => {
    expect(keys(all)).toEqual(['agreement:done', 'agreement:gone', 'need:closed', 'application:closed', 'application:back']);
  });
  it('keeps each read\'s own order and groups the kinds Dogovori, tasks, applications', () => {
    const shuffled = archiveEntries({ agreements: [agreement('b', { stanje: 'CANCELLED' }), agreement('a')], needs: [need('2'), need('1')],
      applications: [application('y'), application('x', { stanje: 'WITHDRAWN' })] });
    expect(keys(shuffled)).toEqual(['agreement:b', 'agreement:a', 'need:2', 'need:1', 'application:y', 'application:x']);
  });
  it('says "Završen" and "Otkazan" for a Dogovor, in the shared chip\'s own words', () => {
    expect(all[0]).toMatchObject({ kind: 'dogovor', id: 'done', end: 'completed', status: { key: 'task.completed' }, timeText: '24. sep · 12:00–19:00',
      person: 'Marko', place: 'Liman, Novi Sad', role: 'Tvoj zadatak' });
    expect(all[1]).toMatchObject({ end: 'cancelled', status: { key: 'task.cancelled' } });
  });
  it('asks for the rating of a finished Dogovor when the read says it is due', () => {
    expect(archiveEntries({ agreements: [agreement('due', { ocenaMoguca: true })], needs: null, applications: null })[0].status)
      .toEqual({ key: 'task.completed', detail: 'oceni' });
  });
  it('calls a closed task "Zatvoren" and a closed application "Zatvorena", since the reads keep no reason', () => {
    expect(all[2]).toMatchObject({ kind: 'zadatak', end: 'closed', status: { word: 'Zatvoren', shape: 'dash', tone: 'grey' }, timeText: '10. sep · 09:00–12:00',
      role: 'Tvoj zadatak', person: null });
    expect(all[3]).toMatchObject({ kind: 'prijava', end: 'closed', status: { word: 'Zatvorena', shape: 'dash', tone: 'grey' }, role: 'Tvoja prijava' });
  });
  it('counts a withdrawn application, one I took back, with the cancelled, under the chip\'s "Povučena"', () => {
    expect(all[4]).toMatchObject({ end: 'cancelled', status: { key: 'application.withdrawn' } });
  });
  it('knows nothing of a deleted draft, and reads a failed read as nothing at all', () => {
    expect(archiveEntries({ agreements: null, needs: null, applications: null })).toEqual([]);
    expect(DRAFTS_NOT_KEPT).toBe('Obrisani nacrti se ne čuvaju.');
  });
  it('names an untitled thing by its fallback and keeps a title tidy', () => {
    const [dogovor, task, prijava] = archiveEntries({ agreements: [agreement('a', { naslov: '   ' })], needs: [need('n', { naslov: ' Dugo   čekanje ' })],
      applications: [application('p', { naslov: '' })] });
    expect([dogovor.title, dogovor.fallbackTitle]).toEqual([null, 'Dogovor']);
    expect([task.title, task.fallbackTitle]).toEqual(['Dugo čekanje', 'Zadatak']);
    expect([prijava.title, prijava.fallbackTitle]).toEqual([null, 'Prijava']);
  });
});

describe('the quiet chips "Sve · Otkazani · Istekli · Završeni"', () => {
  const entries = archiveEntries({
    agreements: [agreement('done'), agreement('done2'), agreement('gone', { stanje: 'CANCELLED' })],
    needs: [need('closed')], applications: [application('closed'), application('back', { stanje: 'WITHDRAWN' })],
  });
  it('are those four, in that order', () => {
    expect(ARCHIVE_FILTERS.map(filter => filter.label)).toEqual(['Sve', 'Otkazani', 'Istekli', 'Završeni']);
    expect(ARCHIVE_FILTERS.map(filter => filter.key)).toEqual(['all', 'cancelled', 'expired', 'completed']);
  });
  it('show every entry under "Sve"', () => {
    expect(keys(filterArchive(entries, 'all'))).toEqual(['agreement:done', 'agreement:done2', 'agreement:gone', 'need:closed', 'application:closed', 'application:back']);
  });
  it('show the cancelled (a Dogovor, a withdrawn application), the finished, and the expired ones the reads can name', () => {
    expect(keys(filterArchive(entries, 'cancelled'))).toEqual(['agreement:gone', 'application:back']);
    expect(keys(filterArchive(entries, 'completed'))).toEqual(['agreement:done', 'agreement:done2']);
    expect(keys(filterArchive(entries, 'expired'))).toEqual([]);
  });
  it('leave out the entries whose reason is not kept, and say so', () => {
    expect(hasUnkeptReason(entries)).toBe(true);
    expect(hasUnkeptReason(filterArchive(entries, 'completed'))).toBe(false);
    expect(REASON_NOT_KEPT).toMatch(/„Sve“/);
  });
  it('say an empty chip as "none", in the chip\'s own word, and an empty archive in one sentence', () => {
    expect(EMPTY_ARCHIVE.cancelled).toBe('Nema otkazanih.');
    expect(EMPTY_ARCHIVE.expired).toBe('Nema isteklih.');
    expect(EMPTY_ARCHIVE.completed).toBe('Nema završenih.');
    expect(EMPTY_ARCHIVE.all).toMatch(/^Ovde će stajati/);
    for (const text of Object.values(EMPTY_ARCHIVE)) expect(text).not.toMatch(NO_POSAO);
  });
});

describe('the groups under the chips', () => {
  const many = (count: number, make: (id: string) => ArchiveEntry[]) => Array.from({ length: count }, (_, index) => make(String(index))).flat();
  const build = (dogovori: number, zadaci: number, prijave: number) => [
    ...many(dogovori, id => archiveEntries({ agreements: [agreement(`d${id}`)], needs: null, applications: null })),
    ...many(zadaci, id => archiveEntries({ agreements: null, needs: [need(`n${id}`)], applications: null })),
    ...many(prijave, id => archiveEntries({ agreements: null, needs: null, applications: [application(`a${id}`)] })),
  ];
  it('are Dogovori, Zadaci and Prijave, each counted with its own plural', () => {
    const groups = archiveGroups(build(1, 2, 5), 'all');
    expect(groups.map(group => [group.kind, group.heading, group.count, group.entries.length])).toEqual([
      ['dogovor', 'Dogovori', '1 Dogovor', 1], ['zadatak', 'Zadaci', '2 zadatka', 2], ['prijava', 'Prijave', '5 prijava', 5]]);
  });
  it('count the teens and the twenties the Serbian way', () => {
    expect(archiveGroups(build(11, 12, 14), 'all').map(group => group.count)).toEqual(['11 Dogovora', '12 zadataka', '14 prijava']);
    expect(archiveGroups(build(21, 22, 24), 'all').map(group => group.count)).toEqual(['21 Dogovor', '22 zadatka', '24 prijave']);
  });
  it('leave a kind with none out, and the filter decides what is left', () => {
    const entries = [...build(2, 0, 0), ...archiveEntries({ agreements: [agreement('gone', { stanje: 'CANCELLED' })], needs: null, applications: null })];
    expect(archiveGroups(entries, 'all').map(group => group.kind)).toEqual(['dogovor']);
    expect(archiveGroups(entries, 'cancelled').map(group => [group.kind, group.count])).toEqual([['dogovor', '1 Dogovor']]);
    expect(archiveGroups(entries, 'expired')).toEqual([]);
    expect(archiveGroups([], 'all')).toEqual([]);
  });
});
