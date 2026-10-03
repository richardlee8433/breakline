// Sound manifest. Every mix decision — which file, how loud, how often it may
// retrigger — lives here rather than inside the playback code, so swapping a
// sample or rebalancing the mix is a one-line data edit.
//
// Sources (both CC0): RUOK "Action Game/SHMUP SFX Pack" for the weapons and
// explosions, Kenney "Interface Sounds" for the UI blips.

export const SFX_DIR = './assets/audio/sfx/'
export const MUSIC_DIR = './assets/audio/music/'

export type SfxKey =
  | 'shoot' | 'boss-hurt' | 'bomb' | 'player-hit' | 'siren'
  | 'explosion-small' | 'explosion-large' | 'explosion-boss'
  | 'pickup-power' | 'pickup-bomb' | 'pickup-life'
  | 'gem' | 'graze'

export interface SfxDef {
  /** File name inside SFX_DIR. */
  src: string
  /** Mix level, 0–1. */
  gain: number
  /** Drop retriggers inside this window (ms) so held fire cannot machine-gun
   *  the mixer into mud. */
  throttleMs?: number
  /** Random pitch jitter per trigger, in cents. Keeps repeated shots and
   *  explosions from sounding like one looping sample. */
  detune?: number
}

export const SFX: Record<SfxKey, SfxDef> = {
  // ── weapons ────────────────────────────────────────────────────────────
  // Fire can hit 10/sec at max power, so this has to be one of the short
  // samples (0.20s) — the 1–2s laser shots would smear into a drone.
  shoot:             { src: 'smallshot2.ogg',   gain: 0.20, throttleMs: 55, detune: 45 },
  'boss-hurt':       { src: 'smallshot4.ogg',   gain: 0.16, throttleMs: 70, detune: 110 },

  // ── explosions ─────────────────────────────────────────────────────────
  'explosion-small': { src: 'explosion1.ogg',   gain: 0.40, throttleMs: 40, detune: 130 },
  'explosion-large': { src: 'explosion2.ogg',   gain: 0.55, throttleMs: 60, detune: 90 },
  'explosion-boss':  { src: 'explosion4.ogg',   gain: 0.80 },
  bomb:              { src: 'explosion3.ogg',   gain: 0.70 },
  'player-hit':      { src: 'explosion2.ogg',   gain: 0.85, detune: 60 },

  // ── UI / feedback ──────────────────────────────────────────────────────
  siren:             { src: 'alarm3.ogg',       gain: 0.45 },
  'pickup-power':    { src: 'pickup-power.ogg', gain: 0.50 },
  'pickup-bomb':     { src: 'pickup-bomb.ogg',  gain: 0.50 },
  'pickup-life':     { src: 'pickup-life.ogg',  gain: 0.60 },
  gem:               { src: 'gem.ogg',          gain: 0.28, throttleMs: 25 },
  graze:             { src: 'graze.ogg',        gain: 0.35, throttleMs: 45, detune: 70 },
}

export type MusicKey =
  | 'title' | 'stage1' | 'stage2' | 'stage3'
  | 'boss-intro' | 'boss-loop' | 'stage-clear'

export const MUSIC: Record<MusicKey, string> = {
  title:         'title.ogg',
  stage1:        'stage1.ogg',
  stage2:        'stage2.ogg',
  stage3:        'stage3.ogg',
  'boss-intro':  'boss-intro.ogg',
  'boss-loop':   'boss-loop.ogg',
  'stage-clear': 'stage-clear.ogg',
}

/** Music bus level. SFX levels are per-sound in SFX above. */
export const MUSIC_LEVEL = 0.45
