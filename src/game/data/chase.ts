// Chase prototype tuning (docs/Breakline_Chase_Prototype_Design_v0.2.txt).
// Every number is a starting point for playtests, not a finished balance.
// Lengths are base (480-wide) pixels; callers scale them by SPRITE_SCALE.

export const PLAYER = {
  speed: 300,
  displayH: 72,
  /** Damage-taking core. Tiny on purpose: wings brushing a missile are safe. */
  hitboxSize: 6,
  bankAngle: 0.22,
  /** The ship flies in the upper-middle of the field (fractions of stage
   *  height): the strip below is where pursuers arrive and line up. */
  bandTop: 0.15,
  bandBottom: 0.58,
  /** Where each stage starts, as a fraction of stage height. */
  startY: 0.4,
}

/** The always-on recovery field: a circle around the ship. */
export const FIELD = {
  /** Radius as a multiple of the ship's visible width. Larger than the hit
   *  core, so an energy round always reaches the field first: energy rounds
   *  are harmless, only solid hazards hurt (§3, decided 2026-10-03). */
  radiusFactor: 0.8,
}

export const ENERGY = {
  max: 100,
  perRound: 6,
  /** Banking limit, per second. Rounds past it are still absorbed (the field
   *  never closes), they just add nothing. */
  capPerSec: 18,
}

export const EMP = {
  /** Released by hand once the gauge is full; spends the whole gauge. */
  radiusFrac: 0.7,       // of the playfield width
  disable: 4,            // seconds a normal pursuer stays dark
  disableHardened: 1.5,  // EMP-hardened pursuers (stage 3)
  /** Minimum gap between two pulses. */
  cooldown: 8,
}

export const HULL = {
  /** Fresh every stage. Missiles, rams, rocks and mine blasts cost one each. */
  max: 3,
  iframes: 1.5,
  /** Ticker-timed beat between the last hit and the game-over screen. */
  deathBeat: 1.4,
}

/** Pursuer behaviour. They only ever come from behind (below the ship). */
export const CHASE = {
  /** Warning marker at the bottom edge before a pursuer enters (§2). */
  warnTime: 0.8,
  /** Never closer below the ship than this, so they don't overtake it. */
  minGap: 130,
  /** Preferred distance below the ship. */
  depthMin: 170,
  depthMax: 300,
  /** How far left/right of the ship a pursuer may take up station. */
  laneSpread: 150,
  /** Seconds between lane changes. */
  repositionMin: 2.5,
  repositionMax: 4.5,
  /** After reaching station, wait this long before the first shot. */
  firstShot: 0.7,
  /** A disabled pursuer drifts back with the scenery at this speed. */
  driftSpeed: 190,
}

/** Missile lock: marker + cue for this long before a missile launches. */
export const LOCK = {
  time: 0.75,
}

/** Background scroll speed: higher than the old shooter's, to sell speed. */
export const SCROLL_SPEED = 150
