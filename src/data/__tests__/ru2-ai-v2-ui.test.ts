import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import {
  NEED_FACT_V2_DEFINITIONS,
  NEED_FACT_V2_KEYS,
  AI_PROPOSABLE_NEED_FACT_V2_KEYS,
  REQUIRED_NEED_FACT_V2_KEYS,
  MAX_NEED_FACT_V2_PAYLOAD,
} from '../../contracts/needFactsV2';
import { sortFacts } from '../aiNeedV2Ui';

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
    // The static registry includes the source-only deadline candidate. Edge
    // must still expose the original proposal/question enums with the flag OFF.
    expect(NEED_FACT_V2_KEYS).toHaveLength(25);
    expect(AI_PROPOSABLE_NEED_FACT_V2_KEYS).toHaveLength(22);
    expect(NEED_FACT_V2_DEFINITIONS['need.response_deadline']).toMatchObject({
      valueType: 'OBJECT', privacyClass: 'PUBLIC', requiredForDraft: false,
    });
    const edge = readFileSync(join(__dirname, '../../../supabase/functions/uskoci-ai-interview/index.ts'), 'utf8');
    const keyStart = edge.indexOf('const applicationDeadlineEnabled =');
    const keyEnd = edge.indexOf('const interviewFactKeySet', keyStart);
    const dialogueStart = edge.indexOf('const DIALOGUE_VALUES =');
    const dialogueEnd = edge.indexOf('\n};', dialogueStart) + 3;
    expect(Math.min(keyStart, keyEnd, dialogueStart, dialogueEnd)).toBeGreaterThan(0);
    const declarations = edge.slice(keyStart, keyEnd).replace('export const INTERVIEW_NEED_FACT_V2_KEYS', 'const INTERVIEW_NEED_FACT_V2_KEYS')
      + edge.slice(dialogueStart, dialogueEnd);
    const edgeKeys = (enabled: boolean) => {
      const scope: Record<string, unknown> = {
        Deno: { env: { get: (name: string) => name === 'USKOCI_TASK_AI_APPLICATION_DEADLINE_V1' && enabled ? 'true' : undefined } },
        AI_PROPOSABLE_NEED_FACT_V2_KEYS,
      };
      runInNewContext(`${declarations}\nglobalThis.__result = { proposals: INTERVIEW_NEED_FACT_V2_KEYS, questions: DIALOGUE_VALUES.questionKey };`, scope);
      return JSON.parse(JSON.stringify(scope.__result)) as { proposals: string[]; questions: string[] };
    };
    const off = edgeKeys(false), on = edgeKeys(true);
    expect(off.proposals).toEqual(AI_PROPOSABLE_NEED_FACT_V2_KEYS.filter(key =>
      key !== 'need.required_licenses' && key !== 'need.response_deadline'));
    expect(off.proposals).toHaveLength(20);
    expect(off.questions).not.toContain('need.response_deadline');
    expect(on.proposals).toContain('need.response_deadline');
    expect(on.questions).toContain('need.response_deadline');
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
