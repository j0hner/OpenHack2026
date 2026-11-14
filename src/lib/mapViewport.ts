/** A sub-decimetre coordinate drift is not a new parcel discovery viewport. */
export function coverageBoundsKey(bounds: readonly number[] | null): string {
  return bounds?.map((value) => value.toFixed(6)).join(",") ?? "";
}

export interface MapPixelSize {
  width: number;
  height: number;
}

/** ResizeObserver also runs once on observation. Leaflet's viewport uses integer
 * client pixels; repeated/subpixel-only notifications must not refit the map. */
export function hasMapPixelSizeChanged(
  previous: MapPixelSize,
  next: MapPixelSize,
): boolean {
  const width = Math.round(next.width),
    height = Math.round(next.height);
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    (width !== Math.round(previous.width) ||
      height !== Math.round(previous.height))
  );
}
