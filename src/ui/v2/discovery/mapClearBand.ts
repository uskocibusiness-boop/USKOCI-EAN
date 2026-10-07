import type { PublicBounds } from '../../../data/marketplaceView';

/**
 * Where things are on the Zadaci map, in pixels. The map is north-up and never pitched (rotation and pitch gestures are off), so a row of
 * pixels is one latitude and the view's bounds and height are enough: Web Mercator spaces latitudes by `ln(tan(π/4 + φ/2))`.
 */
const RADIANS = Math.PI / 180;
/** The latitude Web Mercator can draw at all. */
const MERCATOR_LIMIT = 85.0511287798;
const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, lat)) * RADIANS / 2));
const latitude = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RADIANS;
const SIX = 1_000_000;
const six = (value: number) => Math.round(value * SIX) / SIX + 0;

/** The row, in pixels from the top of a view `height` pixels tall that shows `bounds`, at which `lat` is drawn. */
export function rowOfLatitude(bounds: PublicBounds, height: number, lat: number): number {
  const north = mercator(bounds[3]), south = mercator(bounds[1]);
  return north === south ? height / 2 : (north - mercator(lat)) / (north - south) * height;
}

/** The latitude drawn at `row` pixels from the top of a view `height` pixels tall that shows `bounds`. */
export function latitudeAtRow(bounds: PublicBounds, height: number, row: number): number {
  const north = mercator(bounds[3]), south = mercator(bounds[1]);
  return latitude(north - (north - south) * (row / height));
}

/** A band thinner than this (a sheet at its full height, a frame not measured yet) says nothing about where the person looks. */
export const MIN_CLEAR_BAND = 48;

/**
 * The part of the map the person can actually see: below the floating search tools (`top`, pixels from the map's top) and above the list
 * sheet or a card (`bottom`, pixels from the map's top), across the whole width. The list follows this band; the map's own buckets keep the
 * whole view. The full bounds come back when the band is too thin to mean anything; an edge that is not covered keeps its exact bound.
 */
export function clearBandBounds(bounds: PublicBounds, height: number, top: number, bottom: number): PublicBounds {
  if (!(height > 0) || !Number.isFinite(top) || !Number.isFinite(bottom)) return bounds;
  const upper = Math.max(0, Math.min(height, top)), lower = Math.max(0, Math.min(height, bottom));
  if (lower - upper < MIN_CLEAR_BAND || (upper === 0 && lower === height)) return bounds;
  const north = upper > 0 ? six(latitudeAtRow(bounds, height, upper)) : bounds[3];
  const south = lower < height ? six(latitudeAtRow(bounds, height, lower)) : bounds[1];
  return north > south ? [bounds[0], south, bounds[2], north] : bounds;
}

/**
 * The map's controls: the zoom buttons and "U blizini" stand in one row directly ABOVE the list sheet and move with it
 * (UX plan section P: "uvek iznad spiska, ili u traci mape kad je spisak do vrha; nikad ispod njega"). These are the numbers
 * that keep them there, as pure arithmetic: the sheet's position is a shared value on the UI thread, so `sheetEdge` and
 * `controlsTop` are worklets and run there frame by frame; nothing here waits for React.
 */

/** The touch size of one control in the row: a full 44 (the owner's floor), drawn as a circle or half a capsule. */
export const CONTROL_SIZE = 44;
/** The air between two controls of the row. */
export const CONTROL_GAP = 8;

/**
 * The line the controls must stay above: the list sheet's top edge, or the top of a pin's card when the card lies higher
 * (`cover` is how much of the map's bottom the card takes; 0 when there is none). `height` is the map's own height.
 */
export function sheetEdge(sheetTop: number, height: number, cover: number): number {
  'worklet';
  return Math.min(sheetTop, height - Math.max(0, cover));
}

/**
 * Where the row of controls is drawn: its top, in pixels from the top of the map. It stands `gap` above `edge`, and never
 * higher than `minTop`, the strip under the search pill where the row ends when the sheet is full (so it is never behind
 * the list, and never below it).
 */
export function controlsTop(edge: number, rowHeight: number, gap: number, minTop: number): number {
  'worklet';
  return Math.max(minTop, edge - gap - rowHeight);
}

/**
 * Where the list sheet's top edge rests at its FULL height, in pixels from the top of the body: under the search pill, with a
 * strip of map between them. The strip holds the row of controls (and the map's credits) when there is a map, or the
 * "U blizini" button to bring one up; with neither, the sheet stands one gap under the pill and nothing else.
 */
export function fullSheetTop(pillBottom: number, gap: number, rowHeight: number, strip: boolean): number {
  return strip ? pillBottom + gap + rowHeight + gap : pillBottom + gap;
}

/** The zoom capsule: its two halves side by side, 44 each, and the hairline between them. */
export const ZOOM_WIDTH = 2 * CONTROL_SIZE + 1;

/**
 * How wide the row of controls is, from the right edge in: the zoom capsule, then (an air apart) the "U blizini" button. The
 * map's credits take the room that is left of it on the same row.
 */
export function controlsRowWidth(zoom: boolean, locate: boolean): number {
  return (zoom ? ZOOM_WIDTH : 0) + (zoom && locate ? CONTROL_GAP : 0) + (locate ? CONTROL_SIZE : 0);
}
