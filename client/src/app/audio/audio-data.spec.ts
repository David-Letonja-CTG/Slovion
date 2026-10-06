import soundscapes from '../../../public/audio/soundscapes.json';
import alps from '../../../public/audio/music/alps.json';
import cave from '../../../public/audio/music/cave.json';
import city from '../../../public/audio/music/city.json';
import coast from '../../../public/audio/music/coast.json';
import forest from '../../../public/audio/music/forest.json';
import karst from '../../../public/audio/music/karst.json';
import meadow from '../../../public/audio/music/meadow.json';
import mountainForest from '../../../public/audio/music/mountain_forest.json';
import village from '../../../public/audio/music/village.json';
import wetland from '../../../public/audio/music/wetland.json';
import { LAYER_KINDS } from './synth/ambience';
import { TrackFile, parseTrack } from './synth/music';
import { CAVE_MUSIC } from './synth/soundscape';

// Every theme file; the region test in the .NET content tests checks that every region's map has a soundscape.
const THEMES = [
  alps,
  cave,
  city,
  coast,
  forest,
  karst,
  meadow,
  mountainForest,
  village,
  wetland,
] as TrackFile[];

describe('audio data', () => {
  it.each(THEMES.map((theme) => [theme.id, theme] as const))(
    'theme %s parses into a loop',
    (_, theme) => {
      const track = parseTrack(theme);
      expect(track.length).toBeGreaterThan(0);
      expect(track.channels.length).toBeGreaterThan(0);
    },
  );

  it('names each theme file after its id', () => {
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(THEMES.length);
  });

  it('gives every soundscape a known theme and known layers by day and at night', () => {
    const themes = new Set(THEMES.map((theme) => theme.id));
    for (const [mapId, soundscape] of Object.entries(soundscapes)) {
      expect(themes.has(soundscape.music), `${mapId}: theme ${soundscape.music}`).toBe(true);
      for (const layer of [...soundscape.day, ...soundscape.night]) {
        expect((LAYER_KINDS as readonly string[]).includes(layer), `${mapId}: layer ${layer}`).toBe(
          true,
        );
      }
    }
    expect(themes.has(CAVE_MUSIC)).toBe(true);
  });

  it('stays light enough for phones: at most 3 ambience layers (4 with rain) and 3 music channels', () => {
    for (const [mapId, soundscape] of Object.entries(soundscapes)) {
      expect(Math.max(soundscape.day.length, soundscape.night.length), mapId).toBeLessThanOrEqual(
        3,
      );
    }
    for (const theme of THEMES) {
      expect(theme.channels.length, theme.id).toBeLessThanOrEqual(3);
    }
  });

  it('never uses birdsong at night', () => {
    for (const [mapId, soundscape] of Object.entries(soundscapes)) {
      expect(
        soundscape.night.filter((layer) => layer.startsWith('birds')),
        mapId,
      ).toEqual([]);
    }
  });
});
