import { textMap } from '../world/testing';
import { World } from '../world/world';
import {
  FOG_BAND_COLOUR,
  RAIN_COLOUR,
  SNOW_COLOUR,
  WEATHER_TINT,
  Weather,
  drawWeather,
} from './weather';
import { renderWorld } from './world-renderer';

interface Fill {
  readonly style: unknown;
  readonly args: readonly number[];
}

/** Records every fillRect with the fill style it used; jsdom has no canvas implementation. */
function recordingContext() {
  const fills: Fill[] = [];
  const context = {
    fillStyle: '' as unknown,
    fills,
    fillRect(...args: number[]) {
      fills.push({ style: context.fillStyle, args });
    },
    drawImage: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  };
  return context;
}

function draw(weather: Weather, elapsedMs: number, reducedMotion = false) {
  const context = recordingContext();
  drawWeather(context as unknown as CanvasRenderingContext2D, weather, elapsedMs, reducedMotion);
  return context.fills;
}

const withStyle = (fills: readonly Fill[], style: unknown) =>
  fills.filter((fill) => fill.style === style);

describe('drawWeather', () => {
  it('draws nothing in clear weather', () => {
    expect(draw('clear', 1000)).toEqual([]);
  });

  it('tints the map grey when it is cloudy', () => {
    expect(draw('cloudy', 1000)).toEqual([{ style: WEATHER_TINT.cloudy, args: [0, 0, 320, 180] }]);
  });

  it('draws rain as a cool tint and falling streaks that move with the clock', () => {
    const now = draw('rain', 1000);
    const later = draw('rain', 1200);

    expect(now[0]).toEqual({ style: WEATHER_TINT.rain, args: [0, 0, 320, 180] });
    expect(withStyle(now, RAIN_COLOUR)).toHaveLength(240); // 120 streaks of two pixels each
    expect(draw('rain', 1000)).toEqual(now);
    expect(withStyle(later, RAIN_COLOUR)).not.toEqual(withStyle(now, RAIN_COLOUR));
  });

  it('draws snow as flakes and fog as a veil with bands', () => {
    expect(withStyle(draw('snow', 500), SNOW_COLOUR)).toHaveLength(90);
    const fog = draw('fog', 500);
    expect(fog[0]).toEqual({ style: WEATHER_TINT.fog, args: [0, 0, 320, 180] });
    expect(withStyle(fog, FOG_BAND_COLOUR)).toHaveLength(2);
  });

  it.each(['rain', 'snow', 'fog'] as const)(
    'keeps %s still for players who prefer reduced motion',
    (weather) => {
      expect(draw(weather, 1000, true)).toEqual(draw(weather, 9000, true));
    },
  );
});

describe('renderWorld with weather', () => {
  it('draws the weather last, above the map and the time-of-day tint', () => {
    const world = new World(textMap(['S.']), () => undefined);
    world.setWeather('rain');
    const context = recordingContext();
    const image = { name: 'x' } as unknown as CanvasImageSource;

    renderWorld(context as unknown as CanvasRenderingContext2D, world, {
      tileset: image,
      playerSprite: image,
    });

    expect(world.weather).toBe('rain');
    expect(context.fills.at(-1)?.style).toBe(RAIN_COLOUR);
    expect(context.fills.some((fill) => fill.style === WEATHER_TINT.rain)).toBe(true);
  });
});
