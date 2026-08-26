// BURST — the aggression payoff loop.
//
// Chain already multiplied score, but nothing about the ship changed when it
// climbed: a 20-kill chain felt identical to a 2-kill one. BURST closes that
// gap the way Crimzon Clover's BREAK does — the gauge you fill by playing
// dangerously buys a window where the ship actually hits harder.
//
// The gauge is fed by kills AND by grazing, which is what ties the danmaku
// half of the game to the scoring half: flying into a bullet curtain is no
// longer worth a flat +50, it accelerates the next BURST.
//
// Every number here is tuning, deliberately kept out of the systems.

export const BURST_MAX = 100

/** Gauge per grazed bullet. Dense patterns graze fast, so this stays small. */
export const BURST_GAIN_PER_GRAZE = 0.7

/** Gauge per kill, scaled by the enemy's worth (fighter ~1.1 → carrier ~2.5). */
export function burstGainForKill(scoreValue: number): number {
  return 0.8 + scoreValue / 300
}

/** Fraction of the gauge kept after a death. Losing the chain already stings. */
export const BURST_DEATH_RETAIN = 0.5

/** Invincibility granted by the ignition blast, in seconds. */
export const BURST_IGNITE_IFRAMES = 0.7

/** Cap on gems minted from bullets the ignition cancels, so the pool can't
 *  be drained by one activation inside a dense curtain. */
export const BURST_CANCEL_GEMS = 18

export interface BurstTier {
  label: string
  /** Gauge drained per second while this tier is active. */
  drainPerSec: number
  /** Multiplier on every source of player damage. */
  damageMult: number
  /** Multiplier on the fire interval — below 1 means faster. */
  fireRateMult: number
  /** Multiplier stacked on top of the chain multiplier. */
  scoreMult: number
  /** Hull tint while active. */
  tint: number
  /** HUD accent. */
  css: string
}

// Index = burst level. 0 is the inactive baseline so callers can read the
// tier unconditionally instead of branching on "is a burst running".
export const BURST_TIERS: BurstTier[] = [
  {
    label: '', drainPerSec: 0,
    damageMult: 1, fireRateMult: 1, scoreMult: 1,
    tint: 0xffffff, css: '#44ddff',
  },
  {
    label: 'BURST', drainPerSec: 12.5,   // a full gauge lasts 8s untended
    damageMult: 2, fireRateMult: 0.7, scoreMult: 2,
    tint: 0xffdd88, css: '#ffcc33',
  },
  {
    label: 'DOUBLE BURST', drainPerSec: 20,   // 5s, and far harder to refill
    damageMult: 3, fireRateMult: 0.55, scoreMult: 4,
    tint: 0xffaaee, css: '#ff44dd',
  },
]

export const MAX_BURST_LEVEL = BURST_TIERS.length - 1

export function burstTier(level: number): BurstTier {
  return BURST_TIERS[Math.max(0, Math.min(MAX_BURST_LEVEL, level))]
}
