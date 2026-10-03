import { gameStore } from '../../store/gameStore'
import { sampleBank } from './SampleBank'
import { SFX } from '../data/audio'

// Sample playback for every game sound. The public API is unchanged from the
// synthesized version it replaces — call sites keep calling playShoot(),
// playExplosion() and friends; only what comes out of the speaker changed.

class AudioSystem {
  private ctx: AudioContext | null = null

  private get enabled(): boolean {
    return gameStore.getState().soundEnabled
  }

  /**
   * Starts fetching samples. Needs no AudioContext (and so no user gesture),
   * so call it during startup — by the time the player presses START the
   * bytes are usually already in memory, waiting to be decoded.
   */
  preload(): Promise<void> {
    return sampleBank.prefetch()
  }

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ??
        (window as any).webkitAudioContext)()
      // First context means the page has been interacted with: decode now.
      sampleBank.attach(this.ctx).catch((e) => console.error('[audio]', e))
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  private fire(def: typeof SFX[keyof typeof SFX], rate = 1, gain = 1) {
    // At zero volume, play nothing at all rather than a silent voice.
    const volume = gameStore.getState().sfxVolume
    if (volume <= 0 || !this.getCtx()) return
    sampleBank.play(def, rate, gain * volume)
  }

  /** Settings screen: a short, recognisable cue to judge the SFX level by. */
  playPreview() {
    this.fire(SFX['emp-ready'])
  }

  // ── core ────────────────────────────────────────────────────────────────
  /** A quick run of absorbed rounds climbs a semitone each. */
  playAbsorbCatch(nth: number) {
    this.fire(SFX['absorb-catch'], Math.pow(2, Math.min(nth - 1, 12) / 12))
  }

  playEmpReady() {
    this.fire(SFX['emp-ready'])
  }

  playEmp() {
    this.fire(SFX['emp-fire'], 0.85)
    this.fire(SFX['emp-blast'], 0.7)
  }

  // ── pursuers ────────────────────────────────────────────────────────────
  /** Short, sharp lock tone before a missile launches. */
  playMissileLock() {
    this.fire(SFX['missile-lock'], 1.5)
  }

  /** A mine's fuse is lit: urgent, higher than the missile lock. */
  playMineArm() {
    this.fire(SFX['mine-arm'], 1.8)
  }

  /** Heavier, lower thump than any energy cue: a missile is coming. */
  playMissileLaunch() {
    this.fire(SFX['missile-launch'], 0.75)
  }

  // ── explosions ──────────────────────────────────────────────────────────
  playExplosion(size: 'small' | 'large' = 'small') {
    this.fire(size === 'large' ? SFX['explosion-large'] : SFX['explosion-small'])
  }

  playPlayerHit() {
    this.fire(SFX['player-hit'], 0.9)
  }
}

export const audioSystem = new AudioSystem()
