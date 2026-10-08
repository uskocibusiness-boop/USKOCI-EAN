import { existsSync } from 'fs';
import { join } from 'path';
import { read, repo, ratchetOffences, sourceFiles, withoutComments } from './ratchetKit';

/**
 * ONE DIVIDER (composition spec 2026-10-07, "U3" and section 2 "B"; UI/UX pass 2026-10-08, F8a). The app drew its lines 104 times in
 * 50 files, in two thicknesses (1 dp, and the platform's hairline, which is one physical pixel and so a different line on every
 * phone), and a screen with six of them (Kandidati, Prijava) is a screen glued together with lines. Sections are parted by space and
 * rows by an inset divider of 1 dp (`ruleWidth`, `sys.rule`); a full line is only the foot's and a record's "noga".
 *
 * This is a RATCHET, tight both ways like `one-token-source.test.ts`: the table below names TODAY'S 65 files and, for each, how
 * many times it spells the platform's hairline (`hairlineWidth`) and a border drawn on one edge only (`borderTopWidth`,
 * `borderBottomWidth`), in code and not in comments. TODAY'S state is the ceiling: 21 hairlines and 127 one-edge borders. A file
 * that is not on it and spells one fails; a file that spells more than its entry fails ("do not raise the entry"); a file that spells
 * fewer fails too ("lower the entry"), so the change that moves a screen onto `ListRow`, `Section` and `Screen` is the change that
 * lowers its line. Never add one. The six primitives and `layout.ts` spell none, and it is held here.
 */
type Family = 'hairlineWidth' | 'borderEdge';
const COUNTERS: Record<Family, RegExp> = { hairlineWidth: /\bhairlineWidth\b/g, borderEdge: /\bborder(?:Top|Bottom)Width\b/g };
const linesIn = (source: string): Partial<Record<Family, number>> => {
  const code = withoutComments(source);
  return Object.fromEntries((Object.entries(COUNTERS) as [Family, RegExp][]).map(([family, pattern]): [Family, number] => [family, code.match(pattern)?.length ?? 0])
    .filter(([, count]) => count > 0));
};

/** TODAY'S counts per file. It only shrinks. */
const LINES_TODAY: Record<string, Partial<Record<Family, number>>> = {
  'src/app/dizajn-dodaci.tsx': { borderEdge: 2 },
  'src/app/dizajn-dogovori.tsx': { borderEdge: 1 },
  'src/app/dizajn-kalendar.tsx': { borderEdge: 2 },
  'src/app/dizajn-kandidati.tsx': { borderEdge: 1 },
  'src/app/dizajn-mapa.tsx': { borderEdge: 1 },
  'src/app/dizajn-obavestenja.tsx': { borderEdge: 2 },
  'src/app/dizajn-prijava.tsx': { borderEdge: 2 },
  'src/app/dizajn-prijave.tsx': { borderEdge: 1 },
  'src/app/dizajn-tabla.tsx': { borderEdge: 1 },
  'src/ui/agreements/AgreementActionsPresentation.tsx': { hairlineWidth: 2, borderEdge: 2 },
  'src/ui/agreements/AgreementCompletionReview.tsx': { borderEdge: 1 },
  'src/ui/agreements/AgreementListCard.tsx': { borderEdge: 1 },
  'src/ui/auth/AuthSheet.tsx': { borderEdge: 1 },
  'src/ui/calendar/AvailabilityForm.tsx': { borderEdge: 1 },
  'src/ui/calendar/CalendarControls.tsx': { borderEdge: 1 },
  'src/ui/groups/GroupConversationPresentation.tsx': { hairlineWidth: 1, borderEdge: 1 },
  'src/ui/media/AgreementPhotoComposer.tsx': { borderEdge: 1 },
  'src/ui/needs/NeedSearchRecoverySection.tsx': { hairlineWidth: 1, borderEdge: 1 },
  'src/ui/notifications/PushPreferences.tsx': { borderEdge: 2 },
  'src/ui/product/ProductDetails.tsx': { borderEdge: 3 },
  'src/ui/support/SupportPresentation.tsx': { borderEdge: 1 },
  'src/ui/system/Disclosure.tsx': { borderEdge: 1 },
  'src/ui/system/FlowFooter.tsx': { borderEdge: 1 },
  'src/ui/system/Segmented.tsx': { borderEdge: 2 },
  'src/ui/system/Skeleton.tsx': { hairlineWidth: 1, borderEdge: 4 },
  'src/ui/system/TabBarItem.tsx': { borderEdge: 1 },
  'src/ui/v2/TaskFace.tsx': { borderEdge: 3 },
  'src/ui/v2/discovery/DiscoveryListSheet.tsx': { borderEdge: 1 },
  'src/ui/workerProfile/WorkerProfilePresentation.tsx': { borderEdge: 2 },
};

describe('the counter finds a hairline and a one-edge border, in code and nowhere else', () => {
  it('counts each way of spelling them, once each', () => {
    expect(linesIn('s = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c }')).toEqual({ hairlineWidth: 1, borderEdge: 1 });
    expect(linesIn('a = { borderTopWidth: 1 }; b = { borderTopWidth: 1, borderBottomWidth: 1 }')).toEqual({ borderEdge: 3 });
    expect(linesIn('{ height: StyleSheet.hairlineWidth }; { width: StyleSheet.hairlineWidth }')).toEqual({ hairlineWidth: 2 });
  });

  it('does not count a comment, a full border or another word', () => {
    expect(linesIn('// borderTopWidth: StyleSheet.hairlineWidth\n/* borderBottomWidth */ { borderWidth: 1, borderLeftWidth: 3, ruleWidth: 1 }')).toEqual({});
    expect(linesIn('const hairlineWidthLike = 1; const myborderTopWidth = 2;')).toEqual({});
  });
});

// A wave moved some screens onto `ListRow`, `Section` and `Screen`: `RATCHET_PRINT=1 npx jest src/ui/system/__tests__/rule-width-ratchet.test.ts` prints the
// table as it stands today (and the counts above), to paste over `LINES_TODAY`. It prints nothing, and the suite does not look at it, otherwise.
if (process.env.RATCHET_PRINT) {
  it('prints the table as it stands today (RATCHET_PRINT)', () => {
    const today = sourceFiles('src').map(file => [file, linesIn(read(file))] as const).filter(([, counts]) => Object.keys(counts).length > 0);
    const total = (family: Family) => today.reduce((sum, [, counts]) => sum + (counts[family] ?? 0), 0);
    // eslint-disable-next-line no-console
    console.log([`${today.length} files, ${total('hairlineWidth')} hairlines, ${total('borderEdge')} one-edge borders`,
      ...today.map(([file, counts]) => `  '${file}': { ${Object.entries(counts).map(([family, count]) => `${family}: ${count}`).join(', ')} },`)].join('\n'));
  });
}

describe('no screen draws a new line', () => {
  const files = sourceFiles('src');

  it('looks at a real tree, so an empty sweep cannot pass for a clean one', () => {
    expect(files.length).toBeGreaterThan(300);
    expect(Object.keys(LINES_TODAY).length).toBe(29);
  });

  it('no file spells more than its entry, and none spells fewer: it can only shrink, and shrinks with the code', () => {
    const offences = files.flatMap(file => ratchetOffences(file, linesIn(read(file)) as Record<string, number>, (LINES_TODAY[file] ?? {}) as Record<string, number>));
    expect(offences).toEqual([]);
  });

  it('every entry names a real file and a real family, with a count above zero', () => {
    expect(Object.keys(LINES_TODAY).filter(file => !existsSync(join(repo, file)))).toEqual([]);
    for (const [file, counts] of Object.entries(LINES_TODAY)) {
      expect([file, Object.keys(counts).length > 0]).toEqual([file, true]);
      for (const [family, count] of Object.entries(counts)) expect([file, family, Object.keys(COUNTERS).includes(family) && (count as number) > 0]).toEqual([file, family, true]);
    }
  });

  it('the grid draws none: layout.ts and the six primitives spell neither, and Segmented has given up the hairline', () => {
    for (const name of ['layout.ts', 'Screen.tsx', 'Section.tsx', 'ListRow.tsx', 'FactRow.tsx', 'KeyValueRow.tsx', 'Surface.tsx']) {
      const path = `src/ui/system/${name}`;
      expect([path, linesIn(read(path))]).toEqual([path, {}]);
      expect(Object.keys(LINES_TODAY)).not.toContain(path);
    }
    expect(LINES_TODAY['src/ui/system/Segmented.tsx']?.hairlineWidth).toBeUndefined();
  });
});
