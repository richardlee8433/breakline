import { ENERGY, EMP } from '../data/chase'
import { audioSystem } from './AudioSystem'

/**
 * The alien core in the chase prototype: an always-on recovery field that
 * banks energy from absorbed rounds, and the EMP that spends it.
 *
 * Rules (design v0.2 §3–4):
 * - the field never closes and has no heat: every energy round it touches
 *   is absorbed
 * - banking is limited to ENERGY.capPerSec; past that (or with a full
 *   gauge) rounds are still absorbed, they just add nothing
 * - the EMP needs a full gauge and spends all of it, with a minimum gap of
 *   EMP.cooldown between pulses
 *
 * Pure game-side state: GameApp mirrors it into the store for the HUD.
 */
export class CoreSystem {
  energy = 0
  /** Seconds until the EMP may fire again. */
  empCd = 0
  /** Bumped on every absorbed round so the HUD can pulse the gauge. */
  catchSerial = 0
  /** Per-stage counts for the playtest report. */
  tally = { rounds: 0, banked: 0, wasted: 0, emps: 0 }

  // Token bucket for the banking limit: refills at capPerSec, holds one
  // second's worth.
  private budget = ENERGY.capPerSec
  // Recent catches, for the rising pitch of a quick run of them.
  private streak = 0
  private streakT = 0

  get full() { return this.energy >= ENERGY.max }
  get empReady() { return this.full && this.empCd <= 0 }
  /** 0 = just fired, 1 = gap over. */
  get empCharge() { return 1 - Math.max(0, this.empCd) / EMP.cooldown }

  reset() {
    this.energy = 0
    this.empCd = 0
    this.budget = ENERGY.capPerSec
    this.streak = 0
    this.streakT = 0
    this.tally = { rounds: 0, banked: 0, wasted: 0, emps: 0 }
  }

  /** An energy round touched the field. */
  absorb() {
    const wasReady = this.empReady
    const gain = Math.min(ENERGY.perRound, this.budget, ENERGY.max - this.energy)
    this.energy += gain
    this.budget -= gain
    this.catchSerial++
    this.tally.rounds++
    this.tally.banked += gain
    if (gain < ENERGY.perRound) this.tally.wasted += ENERGY.perRound - gain
    this.streak = this.streakT > 0 ? this.streak + 1 : 1
    this.streakT = 0.6
    audioSystem.playAbsorbCatch(this.streak)
    if (!wasReady && this.empReady) audioSystem.playEmpReady()
  }

  /** Spend the gauge on an EMP. Returns false if it isn't ready. */
  fireEmp(): boolean {
    if (!this.empReady) return false
    this.energy = 0
    this.empCd = EMP.cooldown
    this.tally.emps++
    return true
  }

  update(dt: number) {
    const wasReady = this.empReady
    this.budget = Math.min(ENERGY.capPerSec, this.budget + ENERGY.capPerSec * dt)
    if (this.empCd > 0) this.empCd -= dt
    if (this.streakT > 0) this.streakT -= dt
    if (!wasReady && this.empReady) audioSystem.playEmpReady()   // gap ran out on a full gauge
  }
}
