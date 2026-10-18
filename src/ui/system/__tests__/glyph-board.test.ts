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

describe('the tab bar section of the board', () => {
  it('draws the real bar parts and lets the owner tap them: a section of its own with the preview', () => {
    expect(board).toMatch(/import \{[^}]*\bTabBarPreview\b[^}]*\} from '\.\.\/ui\/system\/TabBarItem'/);
    expect(board).toContain('<TabBarPreview />');
  });

  it('does not mislabel two current previews as historical before and after evidence', () => {
    for (const claim of [/Pre \(levo\)/, /posle \(desno\)/i, /how it looked/i, /before on the left/i]) {
      expect([String(claim), claim.test(board)]).toEqual([String(claim), false]);
    }
  });
});

describe('the glyph section of the board', () => {
  it('takes its icon and variant inventory from the shared registry', () => {
    expect(board).toMatch(/import \{[^}]*\bGlyph\b[^}]*\} from '\.\.\/ui\/system\/Glyph'/);
    for (const registry of ['GLYPH_NAMES', 'GLYPH_SIZES', 'GLYPH_TONES']) {
      expect(board).toMatch(new RegExp(`\\b${registry}\\.(?:map|filter)\\(`));
    }
  });

  it('asks the registry for every icon: the board imports no icon package of its own', () => {
    expect(board).not.toMatch(/phosphor-react-native/);
  });
});

describe('the commands section of the board', () => {
  it('shows a bare control and a captioned one side by side, so he can judge a word beside a glyph', () => {
    expect(board).toMatch(/<ChromeIconButton[^>]*glyph="filters"[^>]*caption="Filteri"/);
    expect(board).toMatch(/<ChromeIconButton[^>]*glyph="calendar"[^>]*caption="Raspored"/);
    expect(board).toMatch(/<ChromeIconButton[^>]*glyph="filters"(?![^>]*caption)/);
  });

  // WCAG 2.5.3 (label in name): the word a person SEES on a control is part of the name a screen reader SPEAKS.
  it('speaks every captioned control by a label that contains the word on it', () => {
    const captioned = [...board.matchAll(/<ChromeIconButton\b[^>]*\blabel="([^"]+)"[^>]*\bcaption="([^"]+)"/g)];
    expect(captioned.length).toBeGreaterThan(0);
    for (const [, label, caption] of captioned) expect([label, label.toLowerCase().includes(caption.toLowerCase())]).toEqual([label, true]);
  });

  // The gallery may retire historical sections. Runtime render coverage and
  // design-lab-boundary.test.cjs protect the current board and production isolation.
});
