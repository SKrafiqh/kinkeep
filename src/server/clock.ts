/** The only source of "now" on the server, so tests can set the time. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
