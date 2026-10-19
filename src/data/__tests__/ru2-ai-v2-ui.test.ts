import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import {
  NEED_FACT_V2_DEFINITIONS,
  NEED_FACT_V2_KEYS,
  AI_PROPOSABLE_NEED_FACT_V2_KEYS,
  REQUIRED_NEED_FACT_V2_KEYS,
  MAX_NEED_FACT_V2_PAYLOAD,
} from '../../contracts/needFactsV2';
import {
  correctionFromText,
  factEditorKind,
  factListItems,
  factTimestampFields,
  listCorrectionText,
  sortFacts,
  timestampCorrectionText,
} from '../aiNeedV2Ui';

function fact(overrides: Partial<AiNeedV2Fact> = {}): AiNeedV2Fact {
  return {
    id: 'f1',
    key: 'need.title',
    value: 'Stari naslov',
    displayValue: 'Stari naslov',
    valueType: 'TEXT',
    privacyClass: 'PUBLIC',
    requiredForDraft: true,
    status: 'NEEDS_CONFIRMATION',
    source: 'AI_INFERENCE',
    evidence: 'treba mi pomoć',
    ...overrides,
  };
}

describe('RU-2 typed R02 → R07 contract', () => {
  it('includes explicit handoff without exposing map, photos or identity to AI writes', () => {
    // The count is the point of this guard: the Edge
    // function derives the model's allowed key enum from AI_PROPOSABLE_NEED_FACT_V2_KEYS, so a key
    // added here silently widens what the AI may write the moment the function is redeployed.
    expect(NEED_FACT_V2_KEYS).toHaveLength(24);
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).toHaveLength(21);
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).toContain('need.handoff');
    expect(NEED_FACT_V2_DEFINITIONS['need.handoff']).toEqual({ valueType: 'OBJECT', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Predaja' });
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).toContain('need.price_basis');
    expect(NEED_FACT_V2_DEFINITIONS['need.price_basis'])
      .toMatchObject({ valueType: 'ENUM', privacyClass: 'PUBLIC', requiredForDraft: false });
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).not.toContain('need.verified_identity_required');
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).not.toContain('need.resolved_location');
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).not.toContain('need.public_photo_paths');
    expect(NEED_FACT_V2_DEFINITIONS['need.public_photo_paths'].manualOnly).toBe(true);
    expect(NEED_FACT_V2_DEFINITIONS['need.resolved_location']).toMatchObject({ privacyClass: 'PRIVATE', manualOnly: true, requiredForDraft: false });
    expect(REQUIRED_NEED_FACT_V2_KEYS).toEqual(expect.arrayContaining([
      'need.title',
      'need.description',
      'need.category',
      'need.price_mode',
      'need.schedule_kind',
      'need.people_needed',
      'need.task_country_code',
      'need.task_geography',
    ]));
    expect(NEED_FACT_V2_DEFINITIONS['need.exact_address'].privacyClass).toBe('PRIVATE');
    expect(NEED_FACT_V2_DEFINITIONS['need.access_notes'].privacyClass).toBe('PRIVATE');
  });

  // Five decoders capped a fact payload at the literal 22, which was the key count when they were
  // written. Adding one key left all five a fact short, and they fail all-or-nothing: one fact they
  // cannot place discards the WHOLE review. A maximal task would have gone blank, not lost a row.
  it('caps a fact payload at the size of the registry, never at a number written by hand', () => {
    expect(MAX_NEED_FACT_V2_PAYLOAD).toBe(NEED_FACT_V2_KEYS.length);
    const decoders = ['aiNeedV2Production.ts', 'aiTaskReviewClientService.ts', 'supportCaseReadDecoders.ts'];
    const stillHandWritten = decoders.filter(file => {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      return !source.includes('MAX_NEED_FACT_V2_PAYLOAD') || / > 2[0-9]\b/.test(source);
    });
    expect(stillHandWritten).toEqual([]);
  });

  it('parses integer, boolean and arrays into typed values', () => {
    expect(correctionFromText(fact({ key: 'need.people_needed', valueType: 'INTEGER' }), ' 3 ')).toEqual({
      ok: true,
      value: 3,
      displayValue: '3',
    });
    expect(correctionFromText(fact({ key: 'need.verified_identity_required', valueType: 'BOOLEAN' }), 'ne')).toEqual({
      ok: true,
      value: false,
      displayValue: 'Ne',
    });
    expect(correctionFromText(fact({ key: 'need.required_tools', valueType: 'TEXT_ARRAY' }), 'bušilica, merdevine')).toEqual({
      ok: true,
      value: ['bušilica', 'merdevine'],
      displayValue: 'bušilica, merdevine',
    });
  });

  it('maps human price/schedule wording to backend enums', () => {
    expect(correctionFromText(fact({ key: 'need.price_mode', valueType: 'ENUM' }), 'moja cena')).toEqual({
      ok: true,
      value: 'MY_PRICE',
      displayValue: 'moja cena',
    });
    expect(correctionFromText(fact({ key: 'need.schedule_kind', valueType: 'ENUM' }), 'sutra')).toEqual({
      ok: true,
      value: 'TOMORROW_FLEXIBLE',
      displayValue: 'sutra',
    });
  });


  it('normalizes the explicit task country fact without inferring it from the account city', () => {
    expect(correctionFromText(fact({ key: 'need.task_country_code', valueType: 'TEXT' }), ' rs ')).toEqual({
      ok: true, value: 'RS', displayValue: 'RS',
    });
    expect(correctionFromText(fact({ key: 'need.task_country_code', valueType: 'TEXT' }), 'Serbia')).toMatchObject({ ok: false });
  });

  it('does not allow raw inline editing of structured geography', () => {
    const geo = fact({ key: 'need.task_geography', valueType: 'OBJECT', displayValue: 'Novi Sad' });
    expect(factEditorKind(geo)).toBe('none');
    expect(correctionFromText(geo, 'Beograd')).toEqual({
      ok: false,
      message: 'Lokaciju izmeni kroz razgovor da bi struktura ostala bezbedna.',
    });
  });

  describe('editors for a moment and for a list', () => {
    const start = fact({ id: 's', key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value: '2026-10-03T15:00:00.000Z' });
    const skills = fact({ id: 'k', key: 'need.required_skills', valueType: 'TEXT_ARRAY', value: ['Prevoz, utovar', 'Montaža'] });

    it('gives every value type the editor that fits it, and a structured place none', () => {
      expect(factEditorKind(fact())).toBe('text');
      expect(factEditorKind(start)).toBe('timestamp');
      expect(factEditorKind(skills)).toBe('list');
      expect(factEditorKind(fact({ key: 'need.task_geography', valueType: 'OBJECT', value: {} }))).toBe('none');
    });

    it('shows a moment as the date and the minute the review shows, in the same zone', () => {
      expect(factTimestampFields(start)).toEqual({ date: '2026-10-03', time: '17:00' });
      expect(factTimestampFields(fact({ key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value: 'nije termin' }))).toEqual({ date: '', time: '' });
    });

    it('keeps an untouched moment byte for byte and resolves a changed one through the civil parser', () => {
      const untouched = timestampCorrectionText(start, '2026-10-03', '17:00');
      expect(untouched).toBe('2026-10-03T15:00:00.000Z');
      expect(correctionFromText(start, untouched)).toMatchObject({ ok: true, value: '2026-10-03T15:00:00.000Z' });
      const moved = timestampCorrectionText(start, '2026-10-04', '09:30');
      expect(moved).toBe('2026-10-04 09:30');
      expect(correctionFromText(start, moved)).toMatchObject({ ok: true, value: '2026-10-04T07:30:00.000Z' });
      expect(correctionFromText(start, timestampCorrectionText(start, '2026-10-04', ''))).toMatchObject({ ok: false });
    });

    it('carries a list item with a comma in it through the editor unchanged', () => {
      expect(factListItems(skills)).toEqual(['Prevoz, utovar', 'Montaža']);
      const text = listCorrectionText(['Prevoz, utovar', 'Montaža', 'Bušenje']);
      expect(correctionFromText(skills, text)).toMatchObject({ ok: true, value: ['Prevoz, utovar', 'Montaža', 'Bušenje'] });
      expect(correctionFromText(skills, listCorrectionText([]))).toMatchObject({ ok: true, value: [] });
    });
  });

  it('orders review facts by canonical registry order', () => {
    const ordered = sortFacts([
      fact({ id: '3', key: 'need.people_needed' }),
      fact({ id: '1', key: 'need.title' }),
      fact({ id: '2', key: 'need.category' }),
    ]);
    expect(ordered.map((item) => item.key)).toEqual([
      'need.title',
      'need.category',
      'need.people_needed',
    ]);
  });
});
