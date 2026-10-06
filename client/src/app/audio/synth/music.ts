import { AudioContextLike, Wave } from './audio-context-like';
import { playTone } from './voices';

/** A music file in `public/audio/music/<id>.json` (docs/content.md has the format). */
export interface TrackFile {
  readonly id: string;
  /** Quarter notes per minute. */
  readonly tempo: number;
  readonly channels: readonly {
    readonly wave: Wave;
    readonly volume: number;
    /** Space-separated tokens: `<pitch><octave>:<eighths>` (e.g. `C#5:2`) or a rest `-:<eighths>`. */
    readonly notes: string;
  }[];
}

/** One note or rest, in eighth notes from the start of the loop; `midi` is null for a rest. */
export interface NoteEvent {
  readonly at: number;
  readonly length: number;
  readonly midi: number | null;
}

export interface Track {
  readonly id: string;
  readonly tempo: number;
  /** The loop length in eighth notes; every channel has this length. */
  readonly length: number;
  readonly channels: readonly {
    readonly wave: Wave;
    readonly volume: number;
    readonly events: readonly NoteEvent[];
  }[];
}

const PITCHES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number of a pitch like `C4` (60), `F#3` or `Bb5`. */
export function midiOf(pitch: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(pitch);
  if (!match) throw new Error(`unknown pitch '${pitch}'`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + PITCHES[match[1]] + accidental;
}

export function frequencyOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Parses a music file; every channel must have the same length, so the loop stays in time. */
export function parseTrack(file: TrackFile): Track {
  if (!(file.tempo > 0)) throw new Error(`${file.id}: tempo must be positive`);
  if (file.channels.length === 0) throw new Error(`${file.id}: no channels`);
  const channels = file.channels.map((channel, index) => {
    let at = 0;
    const events = channel.notes
      .trim()
      .split(/\s+/)
      .map((token) => {
        const [pitch, length] = token.split(':');
        const eighths = Number(length);
        if (!Number.isInteger(eighths) || eighths <= 0) {
          throw new Error(`${file.id}: channel ${index + 1}: bad length in '${token}'`);
        }
        let midi: number | null;
        try {
          midi = pitch === '-' ? null : midiOf(pitch);
        } catch {
          throw new Error(`${file.id}: channel ${index + 1}: unknown pitch in '${token}'`);
        }
        const event = { at, length: eighths, midi };
        at += eighths;
        return event;
      });
    return { wave: channel.wave, volume: channel.volume, events, length: at };
  });
  const length = channels[0].length;
  const uneven = channels.findIndex((channel) => channel.length !== length);
  if (uneven >= 0) {
    throw new Error(
      `${file.id}: channel ${uneven + 1} lasts ${channels[uneven].length} eighths, channel 1 lasts ${length}`,
    );
  }
  return {
    id: file.id,
    tempo: file.tempo,
    length,
    channels: channels.map(({ wave, volume, events }) => ({ wave, volume, events })),
  };
}

/**
 * The night arrangement of a theme: slower and quieter, the melody (channel 1) an octave lower on a soft triangle
 * wave, and every second note of the other channels left out.
 */
export function nightArrangement(track: Track): Track {
  return {
    id: `${track.id}:night`,
    tempo: track.tempo * 0.75,
    length: track.length,
    channels: track.channels.map((channel, index) => ({
      wave: index === 0 ? 'triangle' : channel.wave,
      volume: channel.volume * 0.7,
      events:
        index === 0
          ? channel.events.map((event) => ({
              ...event,
              midi: event.midi === null ? null : event.midi - 12,
            }))
          : channel.events.map((event, n) => (n % 2 === 1 ? { ...event, midi: null } : event)),
    })),
  };
}

/** How far ahead notes are put on the audio clock, and how often the scheduler looks. */
export const LOOKAHEAD_SECONDS = 0.12;
export const SCHEDULE_INTERVAL_MS = 25;
/** Crossfades between themes take this long. */
export const CROSSFADE_SECONDS = 2;

/** Timers the players use; tests replace them with fake timers. */
export interface Timers {
  setInterval(callback: () => void, ms: number): number;
  clearInterval(handle: number): void;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

export const browserTimers: Timers = {
  setInterval: (callback, ms) => window.setInterval(callback, ms),
  clearInterval: (handle) => window.clearInterval(handle),
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

interface Playback {
  readonly track: Track;
  readonly gain: GainNode;
  /** Audio-clock time of the loop's first eighth. */
  readonly startedAt: number;
  /** The next eighth (from startedAt) still to be scheduled, per channel event index. */
  nextEighth: number;
  stopAt?: number;
}

/**
 * Loops one theme at a time into `output`, scheduling notes slightly ahead on the audio clock. A new theme
 * crossfades with the old one.
 */
export class MusicPlayer {
  private playing: Playback | undefined;
  private fading: Playback[] = [];
  private timer: number | undefined;

  constructor(
    private readonly context: AudioContextLike,
    private readonly output: AudioNode,
    private readonly timers: Timers = browserTimers,
  ) {}

  /** The id of the theme now playing (the night arrangement's id ends in `:night`). */
  get current(): string | undefined {
    return this.playing?.track.id;
  }

  /** Crossfades to `track`; playing the same theme again changes nothing. `undefined` fades the music out. */
  play(track: Track | undefined): void {
    if (track?.id === this.playing?.track.id) return;
    const now = this.context.currentTime;
    if (this.playing) {
      const old = this.playing;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
      old.stopAt = now + CROSSFADE_SECONDS;
      this.fading.push(old);
    }
    this.playing = undefined;
    if (track) {
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
      gain.connect(this.output);
      this.playing = { track, gain, startedAt: now + 0.05, nextEighth: 0 };
    }
    this.ensureTimer();
    this.schedule();
  }

  stop(): void {
    this.play(undefined);
  }

  private ensureTimer(): void {
    if (this.timer === undefined) {
      this.timer = this.timers.setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS);
    }
  }

  /** Puts every note that starts within the look-ahead window on the audio clock. */
  private schedule(): void {
    const now = this.context.currentTime;
    const horizon = now + LOOKAHEAD_SECONDS;
    for (const playback of [this.playing, ...this.fading]) {
      if (playback) this.scheduleNotes(playback, horizon);
    }
    this.fading = this.fading.filter((playback) => {
      if (playback.stopAt !== undefined && now >= playback.stopAt) {
        playback.gain.disconnect();
        return false;
      }
      return true;
    });
    if (!this.playing && this.fading.length === 0 && this.timer !== undefined) {
      this.timers.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNotes(playback: Playback, horizon: number): void {
    const { track } = playback;
    const eighth = 60 / track.tempo / 2;
    while (playback.startedAt + playback.nextEighth * eighth < horizon) {
      const loopEighth = playback.nextEighth % track.length;
      const loopStart = playback.startedAt + (playback.nextEighth - loopEighth) * eighth;
      for (const channel of track.channels) {
        for (const event of channel.events) {
          if (event.at !== loopEighth || event.midi === null) continue;
          const start = loopStart + event.at * eighth;
          if (playback.stopAt !== undefined && start >= playback.stopAt) continue;
          playTone(this.context, playback.gain, {
            wave: channel.wave,
            frequency: frequencyOf(event.midi),
            start,
            duration: event.length * eighth * 0.9,
            volume: channel.volume,
          });
        }
      }
      playback.nextEighth++;
    }
  }
}
