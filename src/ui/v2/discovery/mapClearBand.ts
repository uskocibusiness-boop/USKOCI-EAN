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
