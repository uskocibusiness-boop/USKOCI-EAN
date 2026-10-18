import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The design board on the phone (`uskociapp://dizajn-tabla`, internal build only) shows the wave-2 shell beside the icons it
 * already carried, so the owner can hold the new tab bar and the control glyphs in his hand and compare them on the real
 * screen. The board itself needs a router, constants and a task card, so it is read from its source here, the way
 * `fact-art.test.tsx` reads it; the pieces it draws are tested on their own (`tab-bar-item.test.tsx`, `glyph.test.tsx`,
 * `screen-chrome.test.tsx`).
 */
const board = readFileSync(join(__dirname, '../../../designLab/dizajn-tabla.tsx'), 'utf8').replace(/\r\n/g, '\n');
const flat = board.replace(/\s*\n\s*\*?\s*/g, ' ');

describe('the tab bar section of the board', () => {
  it('draws the real bar parts and lets the owner tap them: a section of its own with the preview', () => {
    expect(board).toMatch(/import \{[^}]*\bTabBarPreview\b[^}]*\} from '\.\.\/ui\/system\/TabBarItem'/);
    expect(board).toContain('<TabBarPreview />');
    expect(board).toContain('title="Donja traka · dodirni da probaš"');
  });

  it('says what it is, in his words: the new bar is built from the same parts as the real one, and it is not a before and after', () => {
    expect(flat).toMatch(/isti delovi kao u pravoj traci/i);
    for (const claim of [/Pre \(levo\)/, /posle \(desno\)/i, /how it looked/i, /before on the left/i]) {
      expect([String(claim), claim.test(board)]).toEqual([String(claim), false]);
    }
  });
});

describe('the glyph section of the board', () => {
  it('draws every name of the registry at the three sizes and in every tone, and the on-state', () => {
    expect(board).toMatch(/import \{[^}]*\bGlyph\b[^}]*\} from '\.\.\/ui\/system\/Glyph'/);
    expect(board).toContain('GLYPH_NAMES.map(name =>');
    expect(board).toContain('GLYPH_SIZES.map(size => <Glyph key={size} name={name} size={size} />)');
    expect(board).toContain('GLYPH_TONES');
    expect(board).toContain('on />');
    expect(board).toContain('title={`Glyph ikone kontrola · ${GLYPH_SIZES.join(\' · \')}`}');
  });

  it('asks the registry for every icon: the board imports no icon package of its own', () => {
    expect(board).not.toMatch(/phosphor-react-native/);
  });
});

describe('the commands section of the board', () => {
  it('shows a bare control and a captioned one side by side, so he can judge a word beside a glyph', () => {
    expect(board).toContain('title="Komande u traci · ikona i ikona sa rečju"');
    expect(board).toMatch(/<ChromeIconButton[^>]*glyph="filters"[^>]*caption="Filteri"/);
    expect(board).toMatch(/<ChromeIconButton[^>]*glyph="calendar"[^>]*caption="Raspored"/);
    expect(board).toMatch(/<ChromeIconButton[^>]*glyph="filters"(?![^>]*caption)/);
  });

  // WCAG 2.5.3 (label in name): the word a person SEES on a control is part of the name a screen reader SPEAKS.
  it('speaks every captioned control by a label that contains the word on it', () => {
    const captioned = [...board.matchAll(/<ChromeIconButton\b[^>]*\blabel="([^"]+)"[^>]*\bcaption="([^"]+)"/g)];
    expect(captioned.length).toBeGreaterThanOrEqual(5);
    for (const [, label, caption] of captioned) expect([label, label.toLowerCase().includes(caption.toLowerCase())]).toEqual([label, true]);
  });

  it('keeps every older section: the system icons, the two cuts, the tones, the pickers and the real task card', () => {
    for (const title of ['Sistemske ikonice ·', 'Dva reza: nalepnica (levo) i oznaka (desno)', 'Dva narandžasta', 'Izbor: koja vozila imaš?', 'Na pravoj kartici zadatka']) {
      expect([title, board.includes(title)]).toEqual([title, true]);
    }
  });
});
