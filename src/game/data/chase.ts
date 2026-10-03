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

/** Guided missiles (stage 3): limited turn rate and a finite life, so they
 *  can always be shaken by moving across their path. */
export const GUIDED = {
  turnRate: 1.7,   // rad/s
  life: 3.4,       // seconds, then the missile burns out
}

/** Asteroids (stage 2). Sizes are drawn diameters in base px; the hit
 *  radius is a smaller share of that (forgiving edges). */
export const ROCK = {
  sizes: {
    small:  { dia: 46,  src: './assets/hazards/rock-small.png' },
    medium: { dia: 80,  src: './assets/hazards/rock-medium.png' },
    large:  { dia: 124, src: './assets/hazards/rock-large.png' },
  },
  hitFrac: 0.36,
  /** Down-screen speed: the ship is flying into them. */
  speed: 165,
  /** A marker on the top edge shows where each rock comes in, this long
   *  before it does. */
  preview: 1.0,
  maxSpin: 0.6,
}
export type RockSize = keyof typeof ROCK.sizes

/** Proximity mines (stage 3): pre-laid, they scroll in from ahead. */
export const MINE = {
  dia: 56,
  src: './assets/hazards/mine.png',
  speed: 150,
  preview: 0.8,
  /** Entering this radius (or touching the body) starts the fuse. */
  triggerRadius: 70,
  /** The blast hits once, at detonation, within this radius. Escaping
   *  from the trigger edge needs (blast − trigger) = 30 px in a second,
   *  a tenth of the ship's speed. */
  blastRadius: 100,
  fuse: 1.0,
  blastFx: 0.25,
}

/** Stage 3's ending: the synchronized jump sequence after the clock. */
export const JUMP = {
  sequence: 2.6,
}
