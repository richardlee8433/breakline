// The core: absorb energy → power the gun and a shield. Bombs are separate:
// they drop from enemies. Every number here is a prototype starting point,
// not a finished balance table.
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
  perCatch: 5,
  /** Every full step of this much energy is one gun level AND one shield
   *  layer: absorbing makes the ship hit harder and last longer at once. */
  perLevel: 20,
}

export const SHIELD = {
  /** A blocked hit costs one level's worth of energy (gun drops a level). */
  cost: ENERGY.perLevel,
  /** Invulnerability after the shield takes a hit. */
  iframes: 1.2,
  /** Hostile fire this close is wiped when the shield breaks, so the hit
   *  that broke it isn't followed by its neighbours on the next frame. */
  clearRadius: 70,
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

export const BOMB = {
  /** Bombs are found, not owned: none at the start, dropped by enemies. */
  start: 0,
  max: 3,
  /** Per enemy kill. */
  dropChance: 0.04,
  /** If no bomb has dropped by this many kills in a run, the next kill drops
   *  one, so the first-bomb tutorial is never left to chance. */
  pityKills: 12,
  /** Same lockout neon-raiden's bomb had, so blasts can't be chained. */
  cooldown: 0.8,
  /** Screen-wide blast: every on-screen enemy takes this once.
   *  A drone (8 HP) dies; a missileer (16 HP) needs two. */
  damage: 10,
  /** Bosses take a share of max HP rather than a flat number, so the blast
   *  stays meaningful when boss HP is retuned. */
  bossDamageFrac: 0.08,
  bossMinDamage: 5,
}
