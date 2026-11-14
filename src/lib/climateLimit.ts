/** A provider quota pauses an observation; it is not an error of the parcel. */
export interface ClimatePause {
  source: "climate";
  kind: "rate-limit";
  retryAt: number;
  message: string;
}
export class ClimateRateLimitError extends Error {
  readonly code = "CLIMATE_RATE_LIMIT";
  constructor(
    message: string,
    readonly retryAt: number,
  ) {
    super(message);
    this.name = "ClimateRateLimitError";
  }
}
export function climatePause(error: unknown): ClimatePause | undefined {
  if (error instanceof ClimateRateLimitError)
    return {
      source: "climate",
      kind: "rate-limit",
      retryAt: error.retryAt,
      message: error.message,
    };
  return undefined;
}
