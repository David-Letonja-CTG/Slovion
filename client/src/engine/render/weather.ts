import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../viewport';

/** A region's weather as the server reports it (docs/decisions.md D11). */
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'snow';

const RAIN_DROPS = 120;
const SNOW_FLAKES = 90;
/** Logical pixels per millisecond. */
const RAIN_SPEED = 0.25;
const SNOW_SPEED = 0.02;
const FOG_SPEED = 0.004;

export const WEATHER_TINT: Record<Weather, string | undefined> = {
  clear: undefined,
  cloudy: 'rgba(60, 64, 72, 0.12)',
  rain: 'rgba(40, 60, 90, 0.15)',
  fog: 'rgba(220, 226, 232, 0.35)',
  snow: 'rgba(200, 210, 225, 0.08)',
};
export const RAIN_COLOUR = 'rgba(180, 200, 230, 0.55)';
export const SNOW_COLOUR = 'rgba(255, 255, 255, 0.9)';
export const FOG_BAND_COLOUR = 'rgba(235, 238, 242, 0.12)';

/** A fixed pseudo-random number in [0, 1) for particle `index`, so every frame places particle `index` the same way. */
function fraction(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const wrap = (value: number, size: number) => ((value % size) + size) % size;

/**
 * Draws the weather over the map (above the time-of-day tint and the torch): rain as falling streaks, snow as
 * drifting flakes, fog as a pale veil with slow bands, cloudy as a light grey tint. Positions come from the game clock
 * (`elapsedMs`), so drawing is deterministic; with `reducedMotion` nothing moves.
 */
export function drawWeather(
  context: CanvasRenderingContext2D,
  weather: Weather,
  elapsedMs: number,
  reducedMotion: boolean,
): void {
  const time = reducedMotion ? 0 : elapsedMs;
  const tint = WEATHER_TINT[weather];
  if (tint) {
    context.fillStyle = tint;
    context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  if (weather === 'rain') {
    context.fillStyle = RAIN_COLOUR;
    for (let i = 0; i < RAIN_DROPS; i++) {
      const y = wrap(fraction(i) * LOGICAL_HEIGHT + time * RAIN_SPEED, LOGICAL_HEIGHT + 8) - 8;
      const x = wrap(fraction(i + RAIN_DROPS) * LOGICAL_WIDTH - y * 0.3, LOGICAL_WIDTH);
      // A short slanted streak: two 1×3 pixels, the lower one a pixel to the left.
      context.fillRect(Math.round(x), Math.round(y), 1, 3);
      context.fillRect(Math.round(x) - 1, Math.round(y) + 3, 1, 3);
    }
  } else if (weather === 'snow') {
    context.fillStyle = SNOW_COLOUR;
    for (let i = 0; i < SNOW_FLAKES; i++) {
      const y = wrap(
        fraction(i) * LOGICAL_HEIGHT + time * SNOW_SPEED * (0.7 + fraction(i + 7) * 0.6),
        LOGICAL_HEIGHT,
      );
      const sway = reducedMotion ? 0 : Math.sin(time / 800 + i) * 3;
      const x = wrap(fraction(i + SNOW_FLAKES) * LOGICAL_WIDTH + sway, LOGICAL_WIDTH);
      context.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  } else if (weather === 'fog') {
    context.fillStyle = FOG_BAND_COLOUR;
    for (const [base, height] of [
      [40, 28],
      [120, 36],
    ]) {
      const y = wrap(base + time * FOG_SPEED, LOGICAL_HEIGHT + height) - height;
      context.fillRect(0, Math.round(y), LOGICAL_WIDTH, height);
    }
  }
}
