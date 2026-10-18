import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Circle, Ellipse, Path, Rect, Stop } from 'react-native-svg';
import {
  FACT_KINDS, FACT_MEANING, FACT_SIZES, FACT_TICK_KINDS, FactArt, MARK_MAX_SIZE, MARK_MIN_STROKE, factCutFor, factMarkFace,
  type FactArtKind, type FactCut, type FactDrawnCut, type FactTone,
} from '../FactArt';
import { sys } from '../tokens';

// This suite measures the retained vector fallback. Bundled art selection and
// semantic-state precedence have separate coverage in fact-material.test.tsx.
jest.mock('../materialSubjects', () => ({ MATERIAL_SUBJECTS: {} }));

/**
 * The fact pictures (UI/UX pass 2026-10-02, item 1.3; audits ICO-01 to ICO-04, Z8, I1, F01). The pictures cannot be seen
 * from a test, so what a person would see is turned into things a test can measure: which cut a size gets, which colours
 * a drawing may use, how much of the canvas each shape covers (a clipped mark or a hairline stroke fails here, not on the
 * phone), how many SVG shapes a picture costs, and whether two kinds could be mistaken for one another.
 */
const WHITE = '#FFFFFF';
const TONES = Object.keys(sys.color.art) as FactTone[];
/** The ladder sizes where the flat mark is drawn: the sizes a card, a chip or a tab uses. */
const SMALL_SIZES = FACT_SIZES.filter(size => size <= MARK_MAX_SIZE);
const colourOf = (value: unknown): string | null => (typeof value === 'string' && value !== 'none' ? value.toUpperCase() : null);

/* -------------------------------------------------------------------------------------------------------------------- */
/* Reading a drawing back: the SVG shapes of a rendered picture, and the box each one covers on the 32-unit canvas.     */
/* -------------------------------------------------------------------------------------------------------------------- */
type Pt = { x: number; y: number };
type Sub = { pts: Pt[]; verts: Pt[]; lines: boolean; closed: boolean };
type Box = { x0: number; y0: number; x1: number; y1: number };

/** The points on an elliptical arc, from the endpoint form SVG uses (the standard conversion to a centre and an angle). */
function arcPoints(p0: Pt, rxIn: number, ryIn: number, rotation: number, large: number, sweep: number, p1: Pt): Pt[] {
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [p1];
  const phi = (rotation * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  const scale = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (scale > 1) { rx *= Math.sqrt(scale); ry *= Math.sqrt(scale); }
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coefficient = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (coefficient * rx * y1) / ry, cyp = (-coefficient * ry * x1) / rx;
  const cx = cos * cxp - sin * cyp + (p0.x + p1.x) / 2, cy = sin * cxp + cos * cyp + (p0.y + p1.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let sweepAngle = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  else if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;
  const steps = 48;
  return Array.from({ length: steps }, (_, at) => {
    const t = start + (sweepAngle * (at + 1)) / steps;
    return { x: cx + cos * rx * Math.cos(t) - sin * ry * Math.sin(t), y: cy + sin * rx * Math.cos(t) + cos * ry * Math.sin(t) };
  });
}

/** Every sub-path of a path string, as sampled points (curves and arcs) and as the vertices a person would call corners. */
function parsePath(d: string): Sub[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const subs: Sub[] = [];
  let at = 0, command = '', current: Pt = { x: 0, y: 0 }, start: Pt = current, sub: Sub | null = null, lastControl: Pt | null = null;
  const next = () => parseFloat(tokens[at++]);
  const add = (point: Pt, sampled: Pt[] = [point], straight = true) => {
    sub!.pts.push(...sampled); sub!.verts.push(point); if (!straight) sub!.lines = false; current = point;
  };
  while (at < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[at])) command = tokens[at++];
    else if (command === 'M') command = 'L';
    else if (command === 'm') command = 'l';
    const relative = command === command.toLowerCase();
    const base = relative ? current : { x: 0, y: 0 };
    const point = (): Pt => { const x = next(), y = next(); return { x: base.x + x, y: base.y + y }; };
    switch (command.toUpperCase()) {
      case 'M': { const p = point(); sub = { pts: [p], verts: [p], lines: true, closed: false }; subs.push(sub); current = start = p; lastControl = null; break; }
      case 'L': add(point()); lastControl = null; break;
      case 'H': add({ x: (relative ? current.x : 0) + next(), y: current.y }); lastControl = null; break;
      case 'V': add({ x: current.x, y: (relative ? current.y : 0) + next() }); lastControl = null; break;
      case 'C': case 'S': {
        const from = current;
        const c1 = command.toUpperCase() === 'S' ? (lastControl ? { x: 2 * from.x - lastControl.x, y: 2 * from.y - lastControl.y } : from) : point();
        const c2 = point(), end = point();
        add(end, Array.from({ length: 16 }, (_, k) => {
          const t = (k + 1) / 16, u = 1 - t;
          return { x: u ** 3 * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * end.x, y: u ** 3 * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * end.y };
        }), false);
        lastControl = c2; break;
      }
      case 'A': {
        const rx = next(), ry = next(), rotation = next(), large = next(), sweep = next();
        const end = point();
        add(end, arcPoints(current, rx, ry, rotation, large, sweep, end), false); lastControl = null; break;
      }
      case 'Z': sub!.closed = true; current = start; lastControl = null; break;
      default: throw new Error(`path command ${command} is not read by this test: ${d}`);
    }
  }
  return subs;
}

type Shape = { kind: 'Path' | 'Circle' | 'Ellipse' | 'Rect'; props: Record<string, any> };
const SHAPE_TYPES: [unknown, Shape['kind']][] = [[Path, 'Path'], [Circle, 'Circle'], [Ellipse, 'Ellipse'], [Rect, 'Rect']];
const half = (shape: Shape) => (colourOf(shape.props.stroke) && Number(shape.props.strokeWidth) > 0 ? Number(shape.props.strokeWidth) / 2 : 0);
const toBox = (points: Pt[], grow: number): Box => ({
  x0: Math.min(...points.map(p => p.x)) - grow, y0: Math.min(...points.map(p => p.y)) - grow,
  x1: Math.max(...points.map(p => p.x)) + grow, y1: Math.max(...points.map(p => p.y)) + grow,
});
/** The box one shape paints, its stroke included (a round cap or join reaches exactly half a stroke past its point). */
function boxOf(shape: Shape): Box {
  const p = shape.props, grow = half(shape);
  switch (shape.kind) {
    case 'Circle': return { x0: p.cx - p.r - grow, y0: p.cy - p.r - grow, x1: p.cx + p.r + grow, y1: p.cy + p.r + grow };
    case 'Ellipse': return { x0: p.cx - p.rx - grow, y0: p.cy - p.ry - grow, x1: p.cx + p.rx + grow, y1: p.cy + p.ry + grow };
    case 'Rect': return { x0: p.x - grow, y0: p.y - grow, x1: p.x + p.width + grow, y1: p.y + p.height + grow };
    default: {
      const points = parsePath(p.d).flatMap(sub => sub.pts);
      const box = toBox(points, 0);
      // A butt end stops at its end point, so a straight band that runs along one axis grows only sideways. Any other path
      // (round caps, joins, a diagonal band) grows by half a stroke in both directions, which can only over-estimate.
      const butt = p.strokeLinecap === 'butt';
      const along = butt && box.y1 - box.y0 === 0 ? 'x' : butt && box.x1 - box.x0 === 0 ? 'y' : null;
      const [gx, gy] = along === 'x' ? [0, grow] : along === 'y' ? [grow, 0] : [grow, grow];
      return { x0: box.x0 - gx, y0: box.y0 - gy, x1: box.x1 + gx, y1: box.y1 + gy };
    }
  }
}

/**
 * The SVG shapes of one picture in drawing order, read from the element tree `FactArt` returns. The component has no hooks,
 * so its function (`memo(...).type`) is called directly: a render through react-test-renderer costs about 30 ms, and the
 * suites below look at every kind, in both cuts, in every tone. One test at the end renders through the real renderer.
 */
type FactProps = React.ComponentProps<typeof FactArt>;
const factArtFunction = (FactArt as unknown as { type: (props: FactProps) => React.ReactElement<any> }).type;
function collect(node: React.ReactNode, out: Shape[]): void {
  if (Array.isArray(node)) { node.forEach(child => collect(child, out)); return; }
  if (!React.isValidElement(node)) return;
  const element = node as React.ReactElement<Record<string, any>>;
  const known = SHAPE_TYPES.find(([type]) => element.type === type);
  if (known) out.push({ kind: known[1], props: element.props });
  collect(element.props.children, out);
}
function shapesOf(props: FactProps): { shapes: Shape[]; svgSize: number; boxSize: number; hidden: boolean; viewBox: string } {
  const box = factArtFunction(props);
  const svg = box.props.children as React.ReactElement<any>;
  const shapes: Shape[] = [];
  collect(svg.props.children, shapes);
  return { shapes, svgSize: Number(svg.props.width), boxSize: Number(box.props.style.width), hidden: box.props['aria-hidden'] === true, viewBox: svg.props.viewBox };
}
const colours = (shapes: Shape[]) => [...new Set(shapes.flatMap(shape => [colourOf(shape.props.fill), colourOf(shape.props.stroke)]).filter((c): c is string => c !== null))];
const solidColours = (shapes: Shape[]) => colours(shapes).filter(colour => /^#[0-9A-F]{6}$/.test(colour));
const gradientColoursOf = (props: FactProps): string[] => {
  const colours: string[] = [];
  const visit = (node: React.ReactNode): void => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!React.isValidElement(node)) return;
    const element = node as React.ReactElement<Record<string, any>>;
    if (element.type === Stop) colours.push(String(element.props.stopColor).toUpperCase());
    visit(element.props.children);
  };
  visit(factArtFunction(props));
  return colours;
};
const paletteColours = (palette: Record<string, string>) => Object.values(palette).map(colour => colour.toUpperCase());
const systemArtColours = [...new Set([WHITE, ...Object.values(sys.color.art).flatMap(paletteColours), ...Object.values(sys.color.artRole).flatMap(paletteColours)])];
const expectFunctionalMark = (shapes: Shape[]) => {
  const used = solidColours(shapes);
  expect(used.length).toBeGreaterThan(0);
  expect(used.some(colour => colour !== WHITE)).toBe(true);
  for (const colour of used) {
    expect(systemArtColours).toContain(colour);
    if (colour !== WHITE) expect(contrast(colour, WHITE)).toBeGreaterThanOrEqual(3);
  }
};
const isGround = (shape: Shape) => shape.kind === 'Ellipse' && shape.props.ry === 1.6 && shape.props.cy === 29.4;

/** WCAG contrast of one #RRGGBB against another. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** A tick is a short stroke down and then a longer one up and to the right: the shape a person reads as "confirmed". */
function hasTick(shapes: Shape[]): boolean {
  return shapes.some(shape => shape.kind === 'Path' && parsePath(shape.props.d).some(sub => {
    if (!sub.lines || sub.closed || sub.verts.length !== 3) return false;
    const [a, b, c] = sub.verts;
    const first = Math.hypot(b.x - a.x, b.y - a.y), second = Math.hypot(c.x - b.x, c.y - b.y);
    return b.y > a.y && b.y > c.y && b.x > a.x && c.x > b.x && first / second > 0.3 && first / second < 0.75;
  }));
}

const signature = (shapes: Shape[]) => shapes.map(shape => `${shape.kind}:${['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height'].map(k => shape.props[k] ?? '').join(',')}`).join('|');

/** Every picture in both cuts, drawn once, for the suites that look at all of them. */
const MARK: Record<string, Shape[]> = {}, ART: Record<string, Shape[]> = {};
beforeAll(() => {
  for (const kind of FACT_KINDS) {
    MARK[kind] = shapesOf({ kind, size: 24, cut: 'mark', tone: 'brand' }).shapes;
    ART[kind] = shapesOf({ kind, size: 32, cut: 'art', tone: 'brand' }).shapes;
  }
});

describe('which cut a size gets', () => {
  it('uses a central optical cut with supported samples on both sides', () => {
    expect(Number.isFinite(MARK_MAX_SIZE)).toBe(true);
    expect(MARK_MAX_SIZE).toBeGreaterThan(0);
    expect(factCutFor(MARK_MAX_SIZE)).toBe('mark');
    expect(factCutFor(MARK_MAX_SIZE + 1)).toBe('art');
    expect(new Set(FACT_SIZES).size).toBe(FACT_SIZES.length);
    expect(FACT_SIZES.some(size => factCutFor(size) === 'mark')).toBe(true);
    expect(FACT_SIZES.some(size => factCutFor(size) === 'art')).toBe(true);
  });

  it('lets the board force a cut, and a size between the two cuts (a Profil row, 26 px) keeps the sticker', () => {
    expect(factCutFor(16, 'art')).toBe('art');
    expect(factCutFor(64, 'mark')).toBe('mark');
    expect(factCutFor(MARK_MAX_SIZE + 2, 'auto')).toBe('art');
  });

  it.each([16, 20, 24, 32, 48, 64])('draws what the cut says at %i px: no ground shadow in the mark, one in the sticker', size => {
    const expected = factCutFor(size);
    for (const kind of ['pin', 'users', 'calendar', 'vehicle'] as FactArtKind[]) {
      const { shapes, svgSize, boxSize } = shapesOf({ kind, size });
      expect(shapes.some(isGround)).toBe(expected === 'art');
      expect(svgSize).toBe(size);
      expect(boxSize).toBe(size);
    }
  });

  it('draws the cut it is asked for whatever the size', () => {
    expect((shapesOf({ kind: 'pin', size: 16, cut: 'art' })).shapes.some(isGround)).toBe(true);
    expect((shapesOf({ kind: 'pin', size: 64, cut: 'mark' })).shapes.some(isGround)).toBe(false);
  });
});

describe('the existing call sites keep working', () => {
  // The sizes the ~140 call sites pass today (read from the source on 2026-10-02), the dynamic ones included.
  const USED_SIZES = [14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48, 56, 72];
  it('draws every kind at every size in use, hidden from screen readers, on the 32-unit canvas', () => {
    for (const kind of FACT_KINDS) for (const size of USED_SIZES) {
      const { shapes, svgSize, boxSize, hidden, viewBox } = shapesOf({ kind, size });
      expect(shapes.length).toBeGreaterThan(0);
      expect(svgSize).toBe(size);
      expect(boxSize).toBe(size);
      expect(hidden).toBe(true);
      expect(viewBox).toBe('0 0 32 32');
    }
  });

  describe('through the real renderer', () => {
    let tree: ReactTestRenderer | undefined;
    afterEach(async () => { await act(async () => tree?.unmount()); });

    it('renders a picture of each cut, hidden from screen readers, at the size asked for', async () => {
      for (const [size, cut] of [[16, 'mark'], [30, 'art']] as [number, FactDrawnCut][]) {
        await act(async () => { tree = create(<FactArt kind="vehicle" size={size} />); });
        const box = tree!.root.findAll(node => node.props?.['aria-hidden'] === true)[0];
        expect(box.props.style).toMatchObject({ width: size, height: size });
        expect(tree!.root.findAll(node => node.props?.viewBox === '0 0 32 32').length).toBeGreaterThan(0);
        expect(tree!.root.findAll(node => node.props?.ry === 1.6 && node.props?.cy === 29.4).length > 0).toBe(cut === 'art');
        await act(async () => tree!.unmount());
      }
    });

    it.each(['vehicle', 'tool'] as FactArtKind[])('%s remains a readable functional mark and honors an inactive state', async kind => {
      await act(async () => { tree = create(<FactArt kind={kind} size={16} />); });
      const used = (root: ReactTestRenderer['root']) => root.findAll(node => typeof node.props?.fill === 'string' || typeof node.props?.stroke === 'string', { deep: true })
        .flatMap(node => [node.props.fill, node.props.stroke]).filter((value): value is string => typeof value === 'string').map(value => value.toUpperCase());
      const active = used(tree!.root).filter(colour => /^#[0-9A-F]{6}$/.test(colour));
      expect(active.some(colour => colour !== WHITE)).toBe(true);
      for (const colour of active.filter(colour => colour !== WHITE)) expect(contrast(colour, WHITE)).toBeGreaterThanOrEqual(3);
      await act(async () => tree!.unmount());
      await act(async () => { tree = create(<FactArt kind={kind} size={20} muted />); });
      expect(used(tree!.root)).toContain(factMarkFace('quiet').toUpperCase());
      expect(used(tree!.root)).not.toEqual(active);
    });
  });

  it('keeps the default size at 20 and accepts `muted` as before, drawing the same shapes in the quiet tone', () => {
    expect((shapesOf({ kind: 'pin' })).boxSize).toBe(20);
    for (const kind of FACT_KINDS) for (const size of [16, 24, 26, 30, 56]) {
      const muted = shapesOf({ kind, size, muted: true });
      const quiet = shapesOf({ kind, size, tone: 'quiet' });
      expect(signature(muted.shapes)).toBe(signature(quiet.shapes));
      expect(colours(muted.shapes)).toEqual(colours(quiet.shapes));
      // `muted` wins over a tone, as it did when it was the only switch.
      expect(colours((shapesOf({ kind, size, muted: true, tone: 'accent' })).shapes)).toEqual(colours(quiet.shapes));
    }
  });
});

describe('the flat mark cut (24 px and below)', () => {
  it.each(FACT_KINDS as readonly FactArtKind[])('%s lies inside the canvas, with no hairline stroke or sliver of fill', kind => {
    for (const shape of MARK[kind]) {
      const box = boxOf(shape);
      // Nothing may touch the edge of the canvas: a shape that does is clipped by it, and a mark that is clipped on one
      // side at 16 px reads as a different picture.
      expect(box.x0).toBeGreaterThanOrEqual(0.5);
      expect(box.y0).toBeGreaterThanOrEqual(0.5);
      expect(box.x1).toBeLessThanOrEqual(31.5);
      expect(box.y1).toBeLessThanOrEqual(31.5);
      if (colourOf(shape.props.stroke)) expect(Number(shape.props.strokeWidth)).toBeGreaterThanOrEqual(MARK_MIN_STROKE);
      if (!colourOf(shape.props.fill)) continue;
      // A filled shape (or each part of a filled path) is at least as thick as the thinnest stroke.
      const parts = shape.kind === 'Path' ? parsePath(shape.props.d).map(sub => toBox(sub.pts, 0)) : [boxOf({ ...shape, props: { ...shape.props, stroke: 'none' } })];
      for (const part of parts) expect(Math.min(part.x1 - part.x0, part.y1 - part.y0)).toBeGreaterThanOrEqual(MARK_MIN_STROKE);
    }
  });

  it.each(FACT_KINDS as readonly FactArtKind[])('%s stays flat and uses readable colors from the shared palette', kind => {
    expect(MARK[kind].some(isGround)).toBe(false);
    expectFunctionalMark(MARK[kind]);
  });

  it.each(FACT_KINDS as readonly FactArtKind[])('%s keeps every white detail on the tone: a white detail that falls off its shape vanishes on a white card', kind => {
    const paintsFace = (shape: Shape) => solidColours([shape]).some(colour => colour !== WHITE && contrast(colour, WHITE) >= 3);
    // The box of what is drawn in the tone (a white rim around a tone shape is not part of it).
    const toneBoxes = MARK[kind].filter(paintsFace).map(shape => boxOf(colourOf(shape.props.stroke) && colourOf(shape.props.stroke) !== WHITE ? shape : { ...shape, props: { ...shape.props, stroke: 'none' } }));
    const union = { x0: Math.min(...toneBoxes.map(b => b.x0)), y0: Math.min(...toneBoxes.map(b => b.y0)), x1: Math.max(...toneBoxes.map(b => b.x1)), y1: Math.max(...toneBoxes.map(b => b.y1)) };
    for (const shape of MARK[kind].filter(s => !paintsFace(s))) {
      const box = boxOf(shape);
      expect(box.x0).toBeGreaterThanOrEqual(union.x0 - 0.01);
      expect(box.y0).toBeGreaterThanOrEqual(union.y0 - 0.01);
      expect(box.x1).toBeLessThanOrEqual(union.x1 + 0.01);
      expect(box.y1).toBeLessThanOrEqual(union.y1 + 0.01);
    }
  });

  it('honors every requested state tone without restricting a mark to one painted part', () => {
    for (const kind of FACT_KINDS) for (const tone of TONES) {
      const shapes = shapesOf({ kind, size: 20, tone }).shapes;
      expectFunctionalMark(shapes);
      const used = solidColours(shapes);
      expect(used.some(colour => paletteColours(sys.color.art[tone]).includes(colour))).toBe(true);
      for (const colour of used) expect([WHITE, ...paletteColours(sys.color.art[tone])]).toContain(colour);
    }
  });

  it('keeps every tone at 3:1 or more against white, and the white detail at 3:1 or more against the tone', () => {
    for (const tone of TONES) {
      expect(contrast(factMarkFace(tone), WHITE)).toBeGreaterThanOrEqual(3);
    }
    for (const tone of TONES) expect(paletteColours(sys.color.art[tone])).toContain(factMarkFace(tone).toUpperCase());
  });

  it('distinguishes a group from one person without requiring a particular SVG construction', () => {
    for (const drawn of [MARK, ART]) {
      expect(signature(drawn.users)).not.toBe(signature(drawn.person));
      const boxes = drawn.users.filter(shape => !isGround(shape)).map(boxOf);
      expect(Math.max(...boxes.map(box => box.x1)) - Math.min(...boxes.map(box => box.x0))).toBeGreaterThanOrEqual(12);
    }
    expect(FACT_MEANING.users).not.toBe(FACT_MEANING.person);
  });

  it('keeps time, task and payment meanings distinct in each rendering cut', () => {
    for (const drawn of [MARK, ART]) {
      expect(new Set(['calendar', 'tasks', 'money'].map(kind => signature(drawn[kind]))).size).toBe(3);
      for (const kind of ['calendar', 'tasks', 'money']) expect(hasTick(drawn[kind])).toBe(false);
    }
  });
});

describe('what a picture costs (B22: every SVG draw is a native view that can be replayed)', () => {
  it('bounds native drawing cost without locking an icon to its old node count', () => {
    for (const kind of FACT_KINDS) {
      expect(MARK[kind].length).toBeGreaterThan(0);
      expect(MARK[kind].length).toBeLessThanOrEqual(8);
      expect(ART[kind].length).toBeGreaterThan(0);
      expect(ART[kind].length).toBeLessThanOrEqual(24);
    }
    const total = (shapes: Record<string, Shape[]>) => Object.values(shapes).reduce((sum, list) => sum + list.length, 0);
    expect(total(MARK)).toBeLessThanOrEqual(FACT_KINDS.length * 6);
  });
});

describe('the sticker (25 px and above)', () => {
  it.each(FACT_KINDS as readonly FactArtKind[])('%s keeps the approved construction: a ground shadow first, every shape inside the canvas', kind => {
    expect(isGround(ART[kind][0])).toBe(true);
    for (const shape of ART[kind]) {
      const box = boxOf(shape);
      expect(box.x0).toBeGreaterThanOrEqual(-0.001);
      expect(box.y0).toBeGreaterThanOrEqual(-0.001);
      expect(box.x1).toBeLessThanOrEqual(32.001);
      expect(box.y1).toBeLessThanOrEqual(32.001);
    }
  });
});

describe('state tones and semantic illustration roles', () => {
  const ATTENTION: FactArtKind[] = ['bell', 'star', 'alert'];

  it('gives attention meanings a shared attention role while permitting other semantic materials', () => {
    for (const kind of FACT_KINDS) for (const size of [16, 24, 32, 56]) {
      const used = colours((shapesOf({ kind, size })).shapes);
      if (ATTENTION.includes(kind)) expect(used.some(colour => paletteColours(sys.color.art.accent).includes(colour))).toBe(true);
      const solids = solidColours(shapesOf({ kind, size }).shapes.filter(shape => !isGround(shape)));
      // Large illustrations also contain neutral paper/metal/detail materials. Their role must be present,
      // but every decorative pixel need not equal one UI color. Functional small marks are stricter above.
      const rolePaints = [...solids, ...gradientColoursOf({ kind, size })];
      expect(rolePaints.some(colour => colour !== WHITE && systemArtColours.includes(colour))).toBe(true);
      expect(solids.length).toBeLessThanOrEqual(12);
    }
  });

  it('keeps the small pin legible and the large pin in its semantic location material', () => {
    expectFunctionalMark(shapesOf({ kind: 'pin', size: 20 }).shapes);
    const used = colours(shapesOf({ kind: 'pin', size: 32 }).shapes);
    expect(used).toContain(sys.color.artRole.location.edge.toUpperCase());
    // The face is now a paint-server reference. Inspect its real stops rather
    // than treating url(#...) as a color or dropping the palette guarantee.
    const stops: string[] = [];
    const visit = (node: React.ReactNode): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!React.isValidElement(node)) return;
      const element = node as React.ReactElement<Record<string, any>>;
      if (element.type === Stop) stops.push(element.props.stopColor);
      visit(element.props.children);
    };
    visit(factArtFunction({ kind: 'pin', size: 32 }));
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.length).toBeLessThanOrEqual(6);
    for (const colour of stops) expect(paletteColours(sys.color.artRole.location)).toContain(colour.toUpperCase());
  });

  it('lets inactive and explicit state tones override the subject material', () => {
    const quiet = Object.values(sys.color.art.quiet).map(c => c.toUpperCase());
    for (const cut of ['mark', 'art'] as FactCut[]) {
      const shapes = shapesOf({ kind: 'calendar', size: 24, muted: true, cut }).shapes;
      const used = colours(shapes.filter(shape => !isGround(shape)));
      for (const shadow of shapes.filter(isGround)) {
        expect(shadow.props.opacity).toBeGreaterThan(0);
        expect(shadow.props.opacity).toBeLessThanOrEqual(0.15);
      }
      for (const colour of used.filter(colour => /^#[0-9A-F]{6}$/.test(colour))) {
        const rgb = [1, 3, 5].map(at => parseInt(colour.slice(at, at + 2), 16));
        // Neutral paper/metal details remain valid when a subject is muted; saturated subject colors do not.
        expect(quiet.includes(colour) || Math.max(...rgb) - Math.min(...rgb) <= 35).toBe(true);
      }
      expect(used.some(c => quiet.includes(c))).toBe(true);
    }
    expect(colours((shapesOf({ kind: 'pin', size: 20, tone: 'accent' })).shapes)).toContain(factMarkFace('accent'));
    expect(colours((shapesOf({ kind: 'pin', size: 20, tone: 'danger' })).shapes)).toContain(factMarkFace('danger').toUpperCase());
  });
});

describe('every picture means one thing, and no two kinds are one silhouette', () => {
  it('has one phrase for every kind and no two kinds share it', () => {
    expect(Object.keys(FACT_MEANING).sort()).toEqual([...FACT_KINDS].sort());
    const phrases = FACT_KINDS.map(kind => FACT_MEANING[kind].trim().toLowerCase());
    for (const phrase of phrases) expect(phrase.length).toBeGreaterThan(3);
    expect(new Set(phrases).size).toBe(phrases.length);
  });

  it('draws no two kinds the same, in either cut', () => {
    for (const drawn of [MARK, ART]) {
      const seen = new Map<string, string>();
      for (const kind of FACT_KINDS) {
        const sig = signature(drawn[kind]);
        expect([kind, seen.get(sig)]).toEqual([kind, undefined]);
        seen.set(sig, kind);
      }
    }
  });

  it('draws the price tag, the agreement and the conversation as three different shapes', () => {
    const pathsOf = (drawn: Record<string, Shape[]>, kind: string) => drawn[kind].filter(s => s.kind === 'Path').map(s => s.props.d as string);
    for (const drawn of [MARK, ART]) {
      const bubbles = [...pathsOf(drawn, 'chat'), ...pathsOf(drawn, 'agreements')];
      // The tag is not a bubble: it shares no path with either, and its outline is a polygon (no tail), not a rounded box.
      for (const d of pathsOf(drawn, 'offers')) expect(bubbles).not.toContain(d);
      for (const d of pathsOf(drawn, 'agreements')) expect(pathsOf(drawn, 'chat')).not.toContain(d);
    }
    expect(FACT_MEANING.offers).not.toBe(FACT_MEANING.agreements);
  });

  it('draws the new task and the clipboard of your own list apart: a badge with a plus, and a clip', () => {
    expect(signature(MARK.publish)).not.toBe(signature(MARK.tasks));
    expect(signature(ART.publish)).not.toBe(signature(ART.tasks));
  });
});

describe('no false ticks', () => {
  it('finds a tick by its shape: a short stroke down and a longer one up, not an arrow head', () => {
    const tick = (d: string): Shape[] => [{ kind: 'Path', props: { d } }];
    expect(hasTick(tick('m10.6 12.9 3.2 3.2 7-7'))).toBe(true);
    expect(hasTick(tick('m9.5 18.5 1.4 1.5 2.3-3'))).toBe(true);
    expect(hasTick(tick('M10.9 10l5.1 5.1 5.1-5.1'))).toBe(false);
    expect(hasTick(tick('M16 8.1v7.4l4.6 3.3'))).toBe(false);
  });

  it('draws a tick on the check, the agreement and the shield only, in both cuts', () => {
    for (const drawn of [MARK, ART]) {
      const withTick = FACT_KINDS.filter(kind => hasTick(drawn[kind]));
      expect([...withTick].sort()).toEqual([...FACT_TICK_KINDS].sort());
    }
  });

  it('draws no tick on the calendar, the task list or the remote screen: an unconfirmed term does not wear a confirmation', () => {
    for (const drawn of [MARK, ART]) for (const kind of ['calendar', 'tasks', 'remote', 'publish', 'offers'] as FactArtKind[]) {
      expect(hasTick(drawn[kind])).toBe(false);
    }
  });
});

describe('the design board on the phone (uskociapp://dizajn-tabla)', () => {
  // The board is where the owner looks at the new system on the phone, so it must show every kind on the ladder, the two cuts
  // side by side at the sizes a card draws, the two oranges of the accent tone, and the four tones. Read from the source: the
  // screen needs a router and a task card.
  const board = readFileSync(join(__dirname, '../../../designLab/dizajn-tabla.tsx'), 'utf8').replace(/\r\n/g, '\n');

  it('draws every kind from FACT_KINDS on the ladder, and the sticker beside the mark at 16, 20 and 24', () => {
    expect(board).toContain('const SYSTEM = FACT_KINDS;');
    expect(board).toMatch(/FACT_SIZES\.map\(/);
    expect(SMALL_SIZES.every(size => Number.isFinite(size) && size > 0 && size <= MARK_MAX_SIZE)).toBe(true);
    expect(board).toContain('cut="art"');
    expect(board).toContain('cut="mark"');
  });

  it('exposes the supported tones for visual inspection', () => {
    for (const tone of TONES) expect(board).toContain(`['${tone}', '${tone} ·`);
    expect(board).toContain('tone={tone}');
  });

  // Wave-1 review, minor (e): the accent sticker (#FA8229) and the accent mark (#C86821) are two oranges; the board shows both.
  it('shows the two oranges side by side: the accent kinds as the sticker at 26 and as the mark at 24', () => {
    expect(board).toContain('ACCENT_KINDS.map(kind =>');
    expect(board).toContain('tone="accent"');
    expect(factCutFor(MARK_MAX_SIZE + 2)).toBe('art');
    expect(factCutFor(MARK_MAX_SIZE)).toBe('mark');
    // The functional cut must remain readable even when the illustration palette changes.
    expect(contrast(factMarkFace('accent'), WHITE)).toBeGreaterThanOrEqual(3);
    expect(board).toMatch(/3:1/);
  });
});

// Explicit state tones override subject colors; test the rendered drawing, not header prose or a hex inventory.
describe('explicit state overrides', () => {
  it('draws the pin\'s hole shade in the tone it is in, so an orange, grey or red pin has no stray green in it', () => {
    const brandEdge = sys.color.art.brand.edge.toUpperCase();
    for (const tone of TONES) {
      const used = colours(shapesOf({ kind: 'pin', size: 32, tone, cut: 'art' }).shapes);
      expect(used).toContain(sys.color.art[tone].edge.toUpperCase());
      if (tone !== 'brand') expect([tone, used.includes(brandEdge), used.includes('#056B4D')]).toEqual([tone, false, false]);
    }
  });
});
