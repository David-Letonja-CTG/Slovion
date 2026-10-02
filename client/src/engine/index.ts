// Public surface of the framework-free game engine.
export { createGame } from './game';
export type { Game, GameOptions, LoadedWorld } from './game';
export type { ActionConsumer } from './input/action-dispatcher';
export type { Action } from './input/actions';
export type { Clock, FrameScheduler, GameEnvironment, Unsubscribe } from './platform';
export { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport';
export { MapFormatError, parseTiledMap } from './world/tiled';
export type { Interaction } from './world/world';
export type { WorldMap } from './world/world-map';
