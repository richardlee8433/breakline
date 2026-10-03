// Sound manifest. Every mix decision — which file, how loud, how often it may
// retrigger — lives here rather than inside the playback code, so swapping a
// sample or rebalancing the mix is a one-line data edit.
//
// Sources (both CC0): RUOK "Action Game/SHMUP SFX Pack" for the weapons and
// explosions, Kenney "Interface Sounds" for the UI blips.

export const SFX_DIR = './assets/audio/sfx/'
export const MUSIC_DIR = './assets/audio/music/'

export type SfxKey =
  | 'player-hit' | 'explosion-small' | 'explosion-large'
  | 'missile-launch' | 'missile-lock'
  | 'absorb-catch' | 'emp-ready' | 'emp-fire' | 'emp-blast'

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
  // ── hits ───────────────────────────────────────────────────────────────
  'explosion-small': { src: 'explosion1.ogg',   gain: 0.40, throttleMs: 40, detune: 130 },
  'explosion-large': { src: 'explosion2.ogg',   gain: 0.55, throttleMs: 60, detune: 90 },
  'player-hit':      { src: 'explosion2.ogg',   gain: 0.85, detune: 60 },

  // ── pursuers ───────────────────────────────────────────────────────────
  // Solid threats sound heavy and urgent; nothing about them is a chime.
  'missile-launch':  { src: 'bigshot1.ogg',     gain: 0.40, throttleMs: 120, detune: 40 },
  'missile-lock':    { src: 'alarm2.ogg',       gain: 0.30, throttleMs: 250 },

  // ── core ───────────────────────────────────────────────────────────────
  // Energy is good news: a light chime per absorbed round (pitch climbs on
  // a quick run of them), a bright cue when the EMP is ready, and the old
  // bomb's release + blast for the pulse itself.
  'absorb-catch':    { src: 'gem-alt.ogg',      gain: 0.30, throttleMs: 30 },
  'emp-ready':       { src: 'pickup-alt.ogg',   gain: 0.45, throttleMs: 300 },
  'emp-fire':        { src: 'bigshot3.ogg',     gain: 0.80 },
  'emp-blast':       { src: 'explosion3.ogg',   gain: 0.55 },
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
