// The core: absorb → convert → counter. Every number here is a prototype
// starting point from the game plan (§4), not a finished balance table.
// Lengths are base (480-wide) pixels; callers scale them by SPRITE_SCALE.

export const ABSORB = {
  /** Press-to-trigger window; holding the key does not extend it. */
  window: 0.6,
  /** Starts when the window closes (or is cancelled by a dash). */
  cooldown: 1.2,
  /** Catch sector: a wedge in front of the nose. Sides and rear stay lethal. */
  radius: 105,
  halfAngleDeg: 50,
  /** Wedge apex offset from the ship's center (+ = behind). At 0, nothing
   *  level with or behind the center can be caught: a round coming in from
   *  the side stays lethal however close it is to the nose. */
  apexOffset: 0,
}

export const ENERGY = {
  max: 100,
  perCatch: 8,
}

export const HEAT = {
  max: 100,
  /** Opening the window costs a little heat even when it catches nothing. */
  perActivation: 10,
  perCatch: 7,
  /** Cooling starts this long after the last heat gain. */
  coolDelay: 0.5,
  coolPerSec: 32,
  /** Overheat locks absorb (only absorb) until heat falls to this. */
  recoverAt: 35,
}

export const DASH = {
  duration: 0.2,
  cooldown: 2,
  distance: 150,
}

export const COUNTER = {
  /** Fixed cost per shot: one decision, one resource. */
  cost: 30,
  /** Same lockout neon-raiden's bomb had, so blasts can't be chained. */
  cooldown: 0.8,
  /** Screen-wide blast, like the old bomb: every on-screen enemy takes
   *  this once. A drone (8 HP) dies; a missileer (16 HP) needs two. */
  damage: 10,
  /** Bosses take a share of max HP rather than a flat number, so the blast
   *  stays meaningful when boss HP is retuned (the bomb's rule). */
  bossDamageFrac: 0.08,
  bossMinDamage: 5,
}
