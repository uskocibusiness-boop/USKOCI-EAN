import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { sourceFiles, read } from '../../system/__tests__/ratchetKit';

/**
 * "Najčešća pitanja" (R09, UI/UX pass 2026-10-08): six questions people ask before they write to support, answered in the app's own words.
 * A DRAFT for the owner's eye, and held to what the owner reserved: no money, no rights or legal text, no promise about how fast support
 * answers, no operator or company data, and no feature that the app does not have: every label it names is a label on a screen.
 */
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../settings/SettingsPresentation', () => ({ SettingsGroup: 'Group', SettingsText: 'T' }));
jest.mock('../../system/Disclosure', () => ({ Disclosure: 'Disclosure' }));
import { SUPPORT_FAQ, SupportFaq } from '../SupportFaq';

let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const all = () => SUPPORT_FAQ.flatMap(item => [item.question, item.answer]).join('\n');

describe('what is drawn', () => {
  it('is one group named "Najčešća pitanja" with six questions, each folded to its words until opened, only the later ones parted by a divider', async () => {
    await act(async () => { tree = create(<SupportFaq />); });
    const group = tree.root.findByType('Group' as React.ElementType);
    expect(group.props.title).toBe('Najčešća pitanja');
    const rows = tree.root.findAllByType('Disclosure' as React.ElementType);
    expect(rows.map(row => row.props.label)).toEqual(SUPPORT_FAQ.map(item => item.question));
    expect(rows.map(row => row.props.divider)).toEqual([false, true, true, true, true, true]);
    expect(rows).toHaveLength(6);
  });

  it('puts each answer inside its own question, as a quiet sentence in reading size', async () => {
    await act(async () => { tree = create(<SupportFaq />); });
    const rows = tree.root.findAllByType('Disclosure' as React.ElementType);
    rows.forEach((row, index) => {
      const answer = row.findAllByType('T' as React.ElementType);
      expect(answer.map(node => node.children.join(''))).toEqual([SUPPORT_FAQ[index].answer]);
      expect(answer[0].props).toMatchObject({ variant: 'copy', tone: 'muted' });
    });
  });
});

describe('the questions and answers', () => {
  it('has six distinct questions, each a question, each with an answer of a sentence or two', () => {
    expect(SUPPORT_FAQ).toHaveLength(6);
    expect(new Set(SUPPORT_FAQ.map(item => item.question)).size).toBe(6);
    for (const item of SUPPORT_FAQ) {
      expect(item.question).toMatch(/\?$/);
      expect(item.answer.length).toBeGreaterThan(40); expect(item.answer.length).toBeLessThan(260);
      expect(item.answer).toMatch(/[.!]$/);
    }
  });

  it('says nothing about money, prices or payment: those words are the owner\'s', () => {
    expect(all()).not.toMatch(/\b(RSD|dinar\w*|cen[aeiu]\w*|plać\w*|plata\w*|novac|novc\w*|naknad\w*|proviz\w*|račun\w*|faktur\w*|besplatn\w*)\b/i);
  });

  it('says nothing about rights, law or operator data: those words are the owner\'s', () => {
    expect(all()).not.toMatch(/\b(zakon\w*|pravn\w*|sud\w*|tužb\w*|odštet\w*|garanci\w*|odgovornost\w*|GDPR|ugovor\w*|firm\w*|PIB|adres[ae] kompanije)\b/i);
    expect(all()).not.toMatch(/@|https?:|www\.|\d{4,}/);
  });

  it('promises no time and no result: support is not said to answer within anything, to act, to decide or to help', () => {
    expect(all()).not.toMatch(/\b(u roku|čim|odmah|brzo|uskoro|24|sati?|dana?|radnih)\b/i);
    expect(all()).not.toMatch(/\b(rešićemo|rešiti|garantujemo|obavezno|sigurno|uvek|nikad\w*|anonim\w*)\b/i);
  });

  it('speaks to the person as "ti", with no grammatical gender', () => {
    expect(all()).not.toMatch(/\b(naručilac|naručioc\w*|uskočer\w*|posao|poslov\w*|korisnik\w*)\b/i);
    expect(all()).not.toMatch(/\b(si|je) (?:\w+)?(?:ao|ila)\b(?! zadatak| Dogovor)/);
  });

  it('answers with what the app does about a report: a report goes to support, and the other person does not see its category, reason or description', () => {
    const report = SUPPORT_FAQ.find(item => item.question === 'Kako da prijavim ili blokiram osobu?')!;
    expect(report.answer).toContain('Prijavu prima podrška'); expect(report.answer).toContain('druga osoba ne vidi kategoriju, razlog ni opis');
  });

  it('names a button only by the words it has on its screen', () => {
    const named = [...new Set(all().match(/„([^“]+)“/g)?.map(quoted => quoted.slice(1, -1)))];
    expect(named.sort()).toEqual(['Izmene i otkazivanje', 'Prijavi ili blokiraj osobu', 'Prijavi problem', 'Zadatak je gotov']);
    const sources = sourceFiles('src').filter(file => !file.endsWith('SupportFaq.tsx') && !file.includes('dizajn-')).map(file => read(file)).join('\n');
    for (const label of named) expect([label, sources.includes(label)]).toEqual([label, true]);
  });
});
