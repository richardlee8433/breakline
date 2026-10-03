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
    if (!this.getCtx()) return
    sampleBank.play(def, rate, gain)
  }

  // ── weapons ─────────────────────────────────────────────────────────────
  playShoot(power = 0) {
    // Higher power reads as a slightly brighter shot, as it did before.
    this.fire(SFX.shoot, 1 + power * 0.035)
  }

  playBossHurt() {
    this.fire(SFX['boss-hurt'])
  }

  // ── explosions ──────────────────────────────────────────────────────────
  playExplosion(size: 'small' | 'large' | 'boss' = 'small') {
    this.fire(
      size === 'boss' ? SFX['explosion-boss']
        : size === 'large' ? SFX['explosion-large']
          : SFX['explosion-small'],
    )
  }

  playBomb() {
    this.fire(SFX.bomb)
  }

  playPlayerHit() {
    this.fire(SFX['player-hit'], 0.9)
  }

  // ── pickups & feedback ──────────────────────────────────────────────────
  playPickup(type: 'power' | 'bomb' | 'life') {
    this.fire(
      type === 'life' ? SFX['pickup-life']
        : type === 'bomb' ? SFX['pickup-bomb']
          : SFX['pickup-power'],
    )
  }

  /** Collect chime climbing one semitone per consecutive gem, as before. */
  playGem(streak = 1) {
    const semitones = Math.min(Math.max(streak - 1, 0), 12)
    this.fire(SFX.gem, Math.pow(2, semitones / 12))
  }

  playGraze() {
    this.fire(SFX.graze)
  }

  playSiren() {
    this.fire(SFX.siren)
  }
}

export const audioSystem = new AudioSystem()
