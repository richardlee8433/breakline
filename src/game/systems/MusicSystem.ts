import { gameStore } from '../../store/gameStore'
import { MUSIC, MUSIC_DIR, MUSIC_LEVEL, MusicKey } from '../data/audio'

// Streaming BGM. Music uses <audio> elements rather than decoded buffers on
// purpose: the seven tracks total about three minutes, which as decoded PCM
// would be well over 100 MB of RAM for no benefit. One-shot SFX, which do
// need sample-accurate latency and overlapping voices, go through SampleBank.
//
// The interval timers below drive audio transport, not gameplay — game timing
// still belongs to the Pixi ticker.

const FADE_MS = 260
const FADE_STEP_MS = 25

class MusicSystem {
  private cache = new Map<MusicKey, HTMLAudioElement>()
  private active = new Set<HTMLAudioElement>()
  private fades = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>()
  /** Tracks fading out to a stop; a level change must not resurrect them. */
  private stopping = new Set<HTMLAudioElement>()
  private handoff: ReturnType<typeof setTimeout> | null = null
  private current: MusicKey | null = null

  constructor() {
    gameStore.subscribe((s, prev) => {
      if (s.soundEnabled === prev.soundEnabled && s.musicVolume === prev.musicVolume) return
      // Keep playing while muted so unmuting drops back in where the track is.
      // A volume drag follows the slider closely; a mute toggle eases.
      const ms = s.soundEnabled === prev.soundEnabled ? 40 : 120
      for (const el of this.active) {
        el.muted = this.silent
        if (!this.stopping.has(el)) this.fade(el, this.level, ms)
      }
    })
  }

  private get level(): number {
    const s = gameStore.getState()
    return s.soundEnabled ? MUSIC_LEVEL * s.musicVolume : 0
  }

  /**
   * Off means `muted`, not just volume 0: iOS/iPadOS ignore scripted
   * HTMLMediaElement.volume and always play at full level, so a volume-only
   * mute let the music through there.
   */
  private get silent(): boolean {
    return this.level === 0
  }

  get playing(): boolean {
    for (const el of this.active) if (!el.paused) return true
    return false
  }

  // ── public transport ────────────────────────────────────────────────────

  /** Stage BGM for the stage the store is currently on. */
  start() {
    this.playStage(gameStore.getState().stage)
  }

  playStage(stage: number) {
    const n = Math.min(Math.max(stage, 1), 3)
    this.crossTo(`stage${n}` as MusicKey, true)
  }

  playTitle() {
    this.crossTo('title', true)
  }

  /** One-shot jingle; leaves silence behind rather than looping. */
  playJingle(key: MusicKey = 'stage-clear') {
    this.crossTo(key, false)
  }

  /**
   * Boss theme: a 2.1s intro that hands over to the 32s main loop. The intro
   * is started at the WARNING banner, so the loop lands just as the boss
   * finishes entering.
   */
  playBoss() {
    this.clearHandoff()
    this.fadeOutAll()

    const intro = this.el('boss-intro')
    const loop = this.el('boss-loop')
    intro.loop = false
    loop.loop = true

    this.begin(intro, 'boss-intro')

    const startLoop = () => {
      this.handoff = null
      this.stopEl(intro)
      this.begin(loop, 'boss-loop')
    }
    const schedule = () => {
      const d = intro.duration
      if (!Number.isFinite(d) || d <= 0) {
        intro.addEventListener('ended', startLoop, { once: true })
        return
      }
      // Hand over just *before* the intro ends — the `ended` event fires late
      // enough to leave an audible gap in a hard-cut chiptune transition.
      this.handoff = setTimeout(startLoop, Math.max(0, (d - 0.06) * 1000))
    }
    if (Number.isFinite(intro.duration) && intro.duration > 0) schedule()
    else intro.addEventListener('loadedmetadata', schedule, { once: true })
  }

  stop() {
    this.clearHandoff()
    this.fadeOutAll()
    this.current = null
  }

  // ── internals ───────────────────────────────────────────────────────────

  private el(key: MusicKey): HTMLAudioElement {
    let a = this.cache.get(key)
    if (!a) {
      a = new Audio(MUSIC_DIR + MUSIC[key])
      a.preload = 'auto'
      this.cache.set(key, a)
    }
    return a
  }

  private crossTo(key: MusicKey, loop: boolean) {
    if (this.current === key && this.playing) return
    this.clearHandoff()
    this.fadeOutAll()
    const a = this.el(key)
    a.loop = loop
    this.begin(a, key)
  }

  private begin(a: HTMLAudioElement, key: MusicKey) {
    this.cancelFade(a)
    this.stopping.delete(a)
    rewind(a)
    a.volume = 0
    a.muted = this.silent
    // Autoplay can still be refused if no gesture has landed yet; that is not
    // an error worth surfacing, the next transport call will try again.
    a.play().catch(() => {})
    this.active.add(a)
    this.current = key
    this.fade(a, this.level, FADE_MS)
  }

  private fadeOutAll() {
    for (const el of [...this.active]) this.fade(el, 0, FADE_MS, true)
  }

  private stopEl(a: HTMLAudioElement) {
    this.cancelFade(a)
    this.stopping.delete(a)
    a.pause()
    rewind(a)
    this.active.delete(a)
  }

  private cancelFade(a: HTMLAudioElement) {
    const id = this.fades.get(a)
    if (id) { clearInterval(id); this.fades.delete(a) }
  }

  private fade(a: HTMLAudioElement, to: number, ms: number, thenStop = false) {
    this.cancelFade(a)
    if (thenStop) this.stopping.add(a)
    const from = a.volume
    const steps = Math.max(1, Math.round(ms / FADE_STEP_MS))
    let i = 0
    const id = setInterval(() => {
      i++
      a.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)))
      if (i < steps) return
      this.cancelFade(a)
      if (thenStop) this.stopEl(a)
    }, FADE_STEP_MS)
    this.fades.set(a, id)
  }

  private clearHandoff() {
    if (this.handoff) { clearTimeout(this.handoff); this.handoff = null }
  }
}

/** Seeking before metadata has loaded throws on Safari; nothing to rewind
 *  yet in that case, since the element has not started. */
function rewind(a: HTMLAudioElement) {
  try { a.currentTime = 0 } catch { /* not seekable yet */ }
}

export const musicSystem = new MusicSystem()
