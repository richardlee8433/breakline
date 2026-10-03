import { ABSORB, ENERGY, HEAT, SHIELD } from '../data/core'
import { audioSystem } from './AudioSystem'

export const MAX_LEVEL = 4

/**
 * The alien core's resources and its absorb window. Pure game-side state:
 * GameApp mirrors it into the store at a throttled rate for the HUD.
 *
 * Rules:
 * - absorb is press-to-trigger, with a fixed window and a cooldown after it
 * - each catch adds energy AND heat; heat cools after a short delay
 * - overheating locks absorb only — the gun and the dash keep working
 * - every ENERGY.perLevel of energy is one gun level and one shield layer;
 *   a hit the shield blocks costs one layer (and so one gun level)
 */
export class CoreSystem {
  /** false = control build for A/B playtests: the core is switched off. */
  enabled = true
  energy = 0
  heat = 0
  overheated = false

  private window = 0         // seconds left in the open absorb window
  private cooldown = 0       // absorb cooldown
  private coolDelay = 0
  private catchesThisWindow = 0

  /** Bumped on every catch so the HUD can replay its "energy jump" pulse. */
  catchSerial = 0
  /** Per-run counts for the playtest report. */
  tally = { windows: 0, whiffs: 0, catches: 0, overheats: 0, shieldBlocks: 0, peakLevel: 0 }

  get absorbing() { return this.window > 0 }
  get absorbReady() {
    return this.enabled && !this.overheated && this.window <= 0 && this.cooldown <= 0
  }
  /** 0 = just used, 1 = ready. For the HUD. */
  get absorbCharge() {
    if (this.window > 0) return 0
    return 1 - Math.max(0, this.cooldown) / ABSORB.cooldown
  }
  /** Gun level 0–4, straight from stored energy. */
  get level() {
    return this.enabled ? Math.min(MAX_LEVEL, Math.floor(this.energy / ENERGY.perLevel)) : 0
  }
  /** Shield layers up (each blocks one hit). */
  get shieldLayers() {
    return this.enabled ? Math.floor(this.energy / SHIELD.cost) : 0
  }

  reset() {
    this.energy = 0; this.heat = 0; this.overheated = false
    this.window = 0; this.cooldown = 0; this.coolDelay = 0
    this.catchesThisWindow = 0
  }

  /** Playtest counts span a whole run, so they reset separately from the
   *  per-stage state above. */
  resetTally() {
    this.tally = { windows: 0, whiffs: 0, catches: 0, overheats: 0, shieldBlocks: 0, peakLevel: 0 }
  }

  /** Try to open the window. Returns false if absorb is unavailable. */
  startAbsorb(): boolean {
    if (!this.absorbReady) return false
    this.window = ABSORB.window
    this.catchesThisWindow = 0
    this.tally.windows++
    this.addHeat(HEAT.perActivation)
    if (this.overheated) return false   // the activation itself tipped it over
    audioSystem.playAbsorbOpen()
    return true
  }

  /** A dash (or an overheat) cuts the window short; cooldown still applies. */
  cancelAbsorb() {
    if (this.window > 0) this.closeWindow()
  }

  /** One absorbable round caught in the window. */
  catchRound() {
    const before = this.level
    this.energy = Math.min(ENERGY.max, this.energy + ENERGY.perCatch)
    this.catchesThisWindow++
    this.catchSerial++
    this.tally.catches++
    audioSystem.playAbsorbCatch(this.catchesThisWindow)
    if (this.level > before) {
      audioSystem.playLevelUp()
      this.tally.peakLevel = Math.max(this.tally.peakLevel, this.level)
    }
    this.addHeat(HEAT.perCatch)
  }

  /** A hit landed while a shield layer was up: spend the layer instead of
   *  the ship. Returns false if there was no shield to spend. */
  breakShield(): boolean {
    if (this.shieldLayers <= 0) return false
    this.energy = Math.max(0, this.energy - SHIELD.cost)
    this.tally.shieldBlocks++
    audioSystem.playShieldBreak()
    return true
  }

  /** The ship was destroyed: whatever energy was left (less than one layer)
   *  goes with it. */
  onDeath() {
    this.energy = 0
    this.cancelAbsorb()
  }

  update(dt: number) {
    if (this.window > 0) {
      this.window -= dt
      if (this.window <= 0) this.closeWindow()
    } else if (this.cooldown > 0) {
      this.cooldown -= dt
    }

    // Heat only bleeds off once absorbing stops (and a beat after the last gain).
    if (this.coolDelay > 0) this.coolDelay -= dt
    else if (this.heat > 0 && this.window <= 0) this.heat = Math.max(0, this.heat - HEAT.coolPerSec * dt)
    if (this.overheated && this.heat <= HEAT.recoverAt) this.overheated = false
  }

  private closeWindow() {
    if (this.catchesThisWindow === 0) this.tally.whiffs++
    this.window = 0
    this.cooldown = ABSORB.cooldown
  }

  private addHeat(n: number) {
    this.heat = Math.min(HEAT.max, this.heat + n)
    this.coolDelay = HEAT.coolDelay
    if (this.heat >= HEAT.max && !this.overheated) {
      this.overheated = true
      this.tally.overheats++
      this.cancelAbsorb()
      audioSystem.playOverheat()
    }
  }
}
