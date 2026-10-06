import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import cave from '../../../public/audio/music/cave.json';
import meadow from '../../../public/audio/music/meadow.json';
import { DEVICE_STORAGE } from '../session/save-token-store';
import { MemoryStorage } from '../testing/test-app';
import {
  AUDIO_CONTEXT_FACTORY,
  AudioService,
  DEFAULT_SOUND_SETTINGS,
  SoundSettings,
} from './audio.service';
import { Soundscapes } from './synth/soundscape';
import { FakeAudioContext, FakeGain } from './testing/fake-audio-context';

const SOUNDSCAPES: Soundscapes = {
  dravsko_polje_meadow: { music: 'meadow', day: ['breeze', 'birds'], night: ['crickets'] },
};
const MEADOW_BY_DAY = {
  mapId: 'dravsko_polje_meadow',
  timeOfDay: 'day',
  weather: 'clear',
  underground: false,
} as const;

function setup(options: { webAudio?: boolean; stored?: object | string } = {}) {
  const storage = new MemoryStorage();
  if (options.stored !== undefined) {
    const stored = options.stored;
    storage.setItem(
      AudioService.storageKey,
      typeof stored === 'string' ? stored : JSON.stringify(stored),
    );
  }
  const contexts: FakeAudioContext[] = [];
  const factory = () => {
    const context = new FakeAudioContext();
    contexts.push(context);
    return context.asContext();
  };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: DEVICE_STORAGE, useValue: storage },
      { provide: AUDIO_CONTEXT_FACTORY, useValue: options.webAudio === false ? null : factory },
    ],
  });
  const audio = TestBed.inject(AudioService);
  const http = TestBed.inject(HttpTestingController);
  const document = TestBed.inject(DOCUMENT);
  return { audio, http, document, storage, contexts };
}

/** Answers the sound data requests: the soundscapes, then every theme they name and the cave theme. */
async function loadData(http: HttpTestingController): Promise<void> {
  http.expectOne('/audio/soundscapes.json').flush(SOUNDSCAPES);
  await Promise.resolve();
  http.expectOne('/audio/music/meadow.json').flush(meadow);
  http.expectOne('/audio/music/cave.json').flush(cave);
  await new Promise((resolve) => setTimeout(resolve));
}

/** The master gain: the first node the mixer makes; 0 when muted. */
const masterOf = (context: FakeAudioContext) => context.nodes[0] as FakeGain;

describe('AudioService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('starts with sound on at a moderate volume', () => {
    const { audio } = setup();

    expect(audio.available).toBe(true);
    expect(audio.settings()).toEqual({ music: 50, sounds: 70, nature: 60, muted: false });
  });

  it('keeps the settings on the device and reads them back', () => {
    const first = setup();
    first.audio.update({ music: 0, muted: true });
    const stored = first.storage.items.get(AudioService.storageKey)!;
    TestBed.resetTestingModule();

    const { audio } = setup({ stored: JSON.parse(stored) as SoundSettings });

    expect(audio.settings()).toEqual({ music: 0, sounds: 70, nature: 60, muted: true });
  });

  it.each([
    ['not JSON', '{oops'],
    ['out of range', { music: 400, sounds: -1, nature: '60', muted: 'yes' }],
  ])('falls back to the defaults for stored settings that are %s', (_, stored) => {
    const { audio } = setup({ stored });

    expect(audio.settings()).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('makes no audio context before the first click, tap or key press', async () => {
    const { audio, http, document, contexts } = setup();
    audio.setScene(MEADOW_BY_DAY);
    audio.play('observe');

    expect(contexts).toHaveLength(0);
    http.expectNone('/audio/soundscapes.json');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    document.dispatchEvent(new Event('pointerdown'));
    await loadData(http);

    expect(contexts).toHaveLength(1);
  });

  it('plays the scene set before sound started once the data has loaded', async () => {
    const { audio, http, document } = setup();
    audio.setScene(MEADOW_BY_DAY);

    document.dispatchEvent(new Event('pointerdown'));
    await loadData(http);

    expect(audio.state).toEqual({ music: 'meadow', layers: ['breeze', 'birds'] });
    audio.setScene({ ...MEADOW_BY_DAY, underground: true });
    expect(audio.state).toEqual({ music: 'cave', layers: ['drips', 'cave-air'] });
  });

  it('mutes at once and keeps playing silently', async () => {
    const { audio, http, document, contexts } = setup();
    document.dispatchEvent(new Event('pointerdown'));
    await loadData(http);

    audio.update({ muted: true });

    expect(masterOf(contexts[0]).gain.value).toBe(0);
    audio.update({ muted: false });
    expect(masterOf(contexts[0]).gain.value).toBe(1);
  });

  it('starts muted when the player muted before', async () => {
    const { http, document, contexts } = setup({
      stored: { ...DEFAULT_SOUND_SETTINGS, muted: true },
    });
    document.dispatchEvent(new Event('pointerdown'));
    await loadData(http);

    expect(masterOf(contexts[0]).gain.value).toBe(0);
  });

  it('suspends the sound while the page is hidden and resumes it when shown', async () => {
    const { http, document, contexts } = setup();
    document.dispatchEvent(new Event('pointerdown'));
    await loadData(http);
    const visibility = vi.spyOn(document, 'visibilityState', 'get');

    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(contexts[0].state).toBe('suspended');

    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(contexts[0].state).toBe('running');
    visibility.mockRestore();
  });

  it('does nothing, without errors, where the browser has no Web Audio', () => {
    const { audio, http, document } = setup({ webAudio: false });

    document.dispatchEvent(new Event('pointerdown'));
    audio.setScene(MEADOW_BY_DAY);
    audio.play('correct');
    audio.duck(true);
    audio.update({ music: 20 });

    expect(audio.available).toBe(false);
    expect(audio.state).toBeUndefined();
    expect(audio.settings().music).toBe(20);
    http.expectNone('/audio/soundscapes.json');
  });

  it('goes on silently when the sound data cannot be loaded', async () => {
    const { audio, http, document } = setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    document.dispatchEvent(new Event('pointerdown'));
    http.expectOne('/audio/soundscapes.json').flush(null, { status: 404, statusText: 'Not Found' });
    await new Promise((resolve) => setTimeout(resolve));
    audio.play('observe');

    expect(audio.state).toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
