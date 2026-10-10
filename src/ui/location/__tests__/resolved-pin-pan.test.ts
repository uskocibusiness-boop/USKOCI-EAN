import fs from 'node:fs';
import path from 'node:path';
import { panFinishedProposal } from '../resolvedPinPan';

const before = { latitude: 45.25, longitude: 19.84 };
const normal = {
  start: { zoom: 15, userInteraction: true },
  finish: { zoom: 15, userInteraction: true, center: [19.85, 45.26] },
  current: before,
  editable: true,
} as const;

describe('task location map pan is only an unconfirmed point proposal', () => {
  it('adopts center only when a user pan finishes, never during automatic recenter', () => {
    expect(panFinishedProposal(normal)).toEqual({ longitude: 19.85, latitude: 45.26 });
    expect(panFinishedProposal({ ...normal, start: { zoom: 15, userInteraction: false } })).toBeNull();
    expect(panFinishedProposal({ ...normal, finish: { ...normal.finish, userInteraction: false } })).toBeNull();
    expect(panFinishedProposal({ ...normal, editable: false })).toBeNull();
  });
  it('does not silently change the task point on zoom, jitter, or invalid map coordinates', () => {
    expect(panFinishedProposal({ ...normal, finish: { ...normal.finish, zoom: 16 } })).toBeNull();
    expect(panFinishedProposal({ ...normal, finish: { ...normal.finish, center: [before.longitude + 0.000001, before.latitude] } })).toBeNull();
    expect(panFinishedProposal({ ...normal, finish: { ...normal.finish, center: [181, 45.26] } })).toBeNull();
    expect(panFinishedProposal({ ...normal, finish: { ...normal.finish, center: [NaN, 45.26] } })).toBeNull();
  });
  it('allows a true pan from an established camera hint while still requiring parent confirmation', () => {
    expect(panFinishedProposal({ ...normal, current: null })).toEqual({ longitude: 19.85, latitude: 45.26 });
    const native = fs.readFileSync(path.resolve(__dirname, '../ResolvedPinMap.tsx'), 'utf8');
    expect(native).toContain('onRegionWillChange={event =>');
    expect(native).toContain('onRegionDidChange={event =>');
    expect(native).toContain('panFinishedProposal({');
    expect(native).toContain('if (point) choose([point.longitude, point.latitude])');
    const editor = fs.readFileSync(path.resolve(__dirname, '../LocationPointEditor.tsx'), 'utf8');
    expect(editor).toContain('const confirm = () => {');
    expect(editor).toContain('onConfirm({ slot, latitudeE6, longitudeE6, origin,');
  });
});
