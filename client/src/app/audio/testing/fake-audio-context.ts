import { AudioContextLike } from '../synth/audio-context-like';

/** A recorded call on an audio parameter: what it set, to which value, at which time. */
export interface ParamCall {
  readonly method: string;
  readonly value: number;
  readonly time: number;
}

export class FakeParam {
  value = 0;
  readonly calls: ParamCall[] = [];
  readonly sources: FakeNode[] = [];

  setValueAtTime(value: number, time: number): this {
    this.calls.push({ method: 'set', value, time });
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ method: 'linear', value, time });
    this.value = value;
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ method: 'exponential', value, time });
    this.value = value;
    return this;
  }
  setTargetAtTime(value: number, time: number): this {
    this.calls.push({ method: 'target', value, time });
    this.value = value;
    return this;
  }
  cancelScheduledValues(time: number): this {
    this.calls.push({ method: 'cancel', value: this.value, time });
    return this;
  }
}

export class FakeNode {
  readonly outputs: (FakeNode | FakeParam)[] = [];
  disconnected = false;

  constructor(readonly kind: string) {}

  connect<T extends FakeNode | FakeParam>(target: T): T {
    this.outputs.push(target);
    if (target instanceof FakeParam) target.sources.push(this);
    return target;
  }
  disconnect(): void {
    this.disconnected = true;
    this.outputs.length = 0;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
  constructor() {
    super('gain');
    this.gain.value = 1;
  }
}

export class FakeOscillator extends FakeNode {
  type = 'sine';
  periodicWave: object | undefined;
  readonly frequency = new FakeParam();
  startedAt: number | undefined;
  stoppedAt: number | undefined;
  constructor() {
    super('oscillator');
  }
  setPeriodicWave(wave: object): void {
    this.periodicWave = wave;
    this.type = 'custom';
  }
  start(time = 0): void {
    this.startedAt = time;
  }
  stop(time = 0): void {
    this.stoppedAt = time;
  }
}

export class FakeFilter extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
  constructor() {
    super('filter');
  }
}

export class FakeBufferSource extends FakeNode {
  buffer: unknown;
  loop = false;
  startedAt: number | undefined;
  stopped = false;
  constructor() {
    super('buffer');
  }
  start(time = 0): void {
    this.startedAt = time;
  }
  stop(): void {
    this.stopped = true;
  }
}

/** Records every node the sound engine makes; `currentTime` is set by the test. */
export class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate = 8000;
  state: AudioContextState = 'running';
  readonly destination = new FakeNode('destination');
  readonly nodes: FakeNode[] = [];

  createGain(): FakeGain {
    return this.track(new FakeGain());
  }
  createOscillator(): FakeOscillator {
    return this.track(new FakeOscillator());
  }
  createBiquadFilter(): FakeFilter {
    return this.track(new FakeFilter());
  }
  createBufferSource(): FakeBufferSource {
    return this.track(new FakeBufferSource());
  }
  createBuffer(_channels: number, length: number): { getChannelData(): Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createPeriodicWave(): object {
    return { periodic: true };
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  /** The oscillators that were started, i.e. the tones played. */
  get tones(): FakeOscillator[] {
    return this.nodes.filter(
      (node): node is FakeOscillator =>
        node instanceof FakeOscillator && node.startedAt !== undefined,
    );
  }

  asContext(): AudioContextLike {
    return this as unknown as AudioContextLike;
  }

  private track<T extends FakeNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
}
