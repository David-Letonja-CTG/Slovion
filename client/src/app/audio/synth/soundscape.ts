import { LAYER_KINDS, LayerKind } from './ambience';

/** `public/audio/soundscapes.json`: per map, its theme and its ambience by day and at night. */
export type Soundscapes = Readonly<Record<string, Soundscape>>;

export interface Soundscape {
  readonly music: string;
  readonly day: readonly LayerKind[];
  readonly night: readonly LayerKind[];
}

/** Where the player is and when, as far as sound cares. */
export interface Scene {
  readonly mapId: string;
  readonly timeOfDay: 'morning' | 'day' | 'evening' | 'night';
  readonly weather: 'clear' | 'cloudy' | 'rain' | 'fog' | 'snow';
  readonly underground: boolean;
}

/** What should play in a scene. */
export interface SceneSound {
  /** The theme's id; the cave theme underground. */
  readonly music: string;
  /** The night arrangement of the theme. */
  readonly night: boolean;
  readonly layers: readonly LayerKind[];
  /** The nature bus level for the weather. */
  readonly natureLevel: number;
}

/** The theme every underground area plays. */
export const CAVE_MUSIC = 'cave';
/** Used when a map has no soundscape (the data test makes sure every map has one). */
const FALLBACK: Soundscape = { music: 'meadow', day: ['breeze'], night: ['crickets'] };

const singing: readonly LayerKind[] = ['birds', 'birds-sparse', 'gulls-generic'];

export function soundFor(scene: Scene, soundscapes: Soundscapes): SceneSound {
  if (scene.underground) {
    return { music: CAVE_MUSIC, night: false, layers: ['drips', 'cave-air'], natureLevel: 1 };
  }
  const soundscape = soundscapes[scene.mapId] ?? FALLBACK;
  const night = scene.timeOfDay === 'night';
  let layers: LayerKind[] = [...(night ? soundscape.night : soundscape.day)];
  if (scene.weather === 'rain') {
    // Rain thins out the birds and is heard over everything else.
    layers = layers.map((layer) => (layer === 'birds' ? 'birds-sparse' : layer));
    layers.push('rain');
  } else if (scene.weather === 'snow') {
    layers = layers.filter((layer) => !singing.includes(layer) && layer !== 'crickets');
  }
  return {
    music: soundscape.music,
    night,
    layers: LAYER_KINDS.filter((kind) => layers.includes(kind)),
    natureLevel: scene.weather === 'fog' ? 0.8 : 1,
  };
}
