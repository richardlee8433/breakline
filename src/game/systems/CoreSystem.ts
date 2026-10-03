import { ABSORB, ENERGY, HEAT, COUNTER } from '../data/core'
import { audioSystem } from './AudioSystem'

/**
 * The alien core's resources and its absorb window. Pure game-side state:
 * GameApp mirrors it into the store at a throttled rate for the HUD.
 *
 * Rules (game plan §4):
 * - absorb is press-to-trigger, with a fixed window and a cooldown after it
 * - each catch adds energy AND heat; heat cools after a short delay
 * - overheating locks absorb only — the gun and the dash keep working
 * - a counter spends a fixed amount of energy
 */
export class CoreSystem {
  /** false = control build for A/B playtests: the core is switched off. */
  enabled = true
  energy = 0
  heat = 0
  overheated = false

  private window = 0         // seconds left in the open absorb window
  private cooldown = 0       // absorb cooldown
  private counterCd = 0
  private coolDelay = 0
  private catchesThisWindow = 0

  /** Bumped on every catch so the HUD can replay its "energy jump" pulse. */
  catchSerial = 0
  /** Per-run counts for the playtest report. */
  tally = { windows: 0, whiffs: 0, catches: 0, counters: 0, overheats: 0 }

  get absorbing() { return this.window > 0 }
  get absorbReady() {
    return this.enabled && !this.overheated && this.window <= 0 && this.cooldown <= 0
  }
  /** 0 = just used, 1 = ready. For the HUD. */
  get absorbCharge() {
    if (this.window > 0) return 0
    return 1 - Math.max(0, this.cooldown) / ABSORB.cooldown
  }
  get counterReady() {
    return this.enabled && this.energy >= COUNTER.cost && this.counterCd <= 0
  }

  reset() {
    this.energy = 0; this.heat = 0; this.overheated = false
    this.window = 0; this.cooldown = 0; this.counterCd = 0; this.coolDelay = 0
    this.catchesThisWindow = 0
    this.tally = { windows: 0, whiffs: 0, catches: 0, counters: 0, overheats: 0 }
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
    const before = this.energy
    this.energy = Math.min(ENERGY.max, this.energy + ENERGY.perCatch)
    this.catchesThisWindow++
    this.catchSerial++
    this.tally.catches++
    audioSystem.playAbsorbCatch(this.catchesThisWindow)
    if (before < COUNTER.cost && this.energy >= COUNTER.cost) audioSystem.playCounterReady()
    this.addHeat(HEAT.perCatch)
  }

  /** Spend energy for one counter shot. Returns false if not affordable. */
  spendCounter(): boolean {
    if (!this.counterReady) return false
    this.energy -= COUNTER.cost
    this.counterCd = COUNTER.cooldown
    this.tally.counters++
    return true
  }

  update(dt: number) {
    if (this.window > 0) {
      this.window -= dt
      if (this.window <= 0) this.closeWindow()
    } else if (this.cooldown > 0) {
      this.cooldown -= dt
    }
    if (this.counterCd > 0) this.counterCd -= dt

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
