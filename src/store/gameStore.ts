import { create } from 'zustand'
import type { GameMode } from '../game/data/stages'
import type { SceneId } from '../game/data/story'
import { BOMB } from '../game/data/core'

/** Chain length → score multiplier tier. */
export function chainMult(chain: number): number {
  return chain >= 20 ? 8 : chain >= 10 ? 4 : chain >= 5 ? 2 : 1
}

/** HUD-facing mirror of the core, written by GameApp at a throttled rate. */
export interface CoreView {
  energy: number        // 0–100
  heat: number          // 0–100
  overheated: boolean
  absorbing: boolean
  absorbCharge: number  // 0 = just used, 1 = ready
  dashCharge: number    // 0 = just used, 1 = ready
  catchSerial: number   // bumps on each catch; drives the energy-bar pulse
  level: number         // gun level 0–4
  shield: number        // shield layers up
}

const freshCore: CoreView = {
  energy: 0, heat: 0, overheated: false, absorbing: false,
  absorbCharge: 1, dashCharge: 1, catchSerial: 0, level: 0, shield: 0,
}

export type HitCause = 'energy' | 'missile' | 'hull' | 'beam'

/**
 * One run's playtest metrics (game plan §14): enough to spot side-hits
 * while absorbing, whiffed windows, dead time while overheated, and how
 * much the shield and bombs carried the run.
 */
export interface RunReport {
  mode: 'core' | 'control'
  cleared: boolean
  seconds: number
  score: number
  windows: number        // absorb windows opened
  whiffs: number         // windows that caught nothing
  catches: number        // rounds absorbed
  peakLevel: number      // highest gun level reached
  shieldBlocks: number   // hits the shield took instead of the ship
  bombsFound: number
  bombsUsed: number
  bombKills: number
  overheats: number
  overheatSeconds: number
  dashes: number
  deaths: Record<HitCause, number>
  deathsWhileAbsorbing: number
}

export interface Hint { id: number; text: string; tone: 'info' | 'warn' }

interface GameState {
  score: number
  hiScore: number
  graze: number
  chain: number
  loop: number   // playthrough number; enemies get faster each loop
  lives: number
  bombs: number
  stage: number
  /** title → (story ↔ playing → stageclear)… → complete | gameover */
  phase: 'title' | 'story' | 'playing' | 'stageclear' | 'gameover' | 'complete'
  mode: GameMode
  /** The dialog playing while phase is 'story'. */
  storyScene: SceneId | null
  /** A short in-combat conversation (tutorials). Combat pauses under it. */
  talk: SceneId | null
  bossHp: number
  bossMaxHp: number
  bossActive: boolean
  bossWarning: boolean
  soundEnabled: boolean
  /** 0–1, multiplied into every music / sfx level. Persisted locally. */
  musicVolume: number
  sfxVolume: number
  paused: boolean
  /** false = A/B control build: same arena, core switched off. */
  coreEnabled: boolean
  core: CoreView
  hint: Hint | null
  report: RunReport | null

  addScore: (n: number) => void
  addKillScore: (base: number) => { awarded: number; mult: number }
  resetChain: () => void
  addGraze: () => void
  loseLife: () => void
  addLife: () => void
  setPhase: (p: GameState['phase']) => void
  setCore: (c: CoreView) => void
  setHint: (h: Hint | null) => void
  setReport: (r: RunReport | null) => void
  startRun: (mode: GameMode, coreEnabled: boolean) => void
  /** Play a story scene (pauses combat until it finishes). */
  playScene: (scene: SceneId) => void
  /** The current scene ended or was skipped. */
  finishScene: () => void
  /** Story mode game over: replay the same stage, no dialog (plan §9). */
  retryStage: () => void
  playTalk: (scene: SceneId) => void
  finishTalk: () => void
  /** Returns false when the stock is full. */
  addBomb: () => boolean
  /** Returns false when there is none to use. */
  useBomb: () => boolean
  setBossHp: (hp: number, max: number) => void
  setBossActive: (v: boolean) => void
  setBossWarning: (v: boolean) => void
  toggleSound: () => void
  setMusicVolume: (v: number) => void
  setSfxVolume: (v: number) => void
  togglePause: () => void
}

const freshPlay = {
  score: 0, graze: 0, chain: 0, loop: 1,
  lives: 3,
  bombs: BOMB.start,
  stage: 1, phase: 'playing' as GameState['phase'],
  storyScene: null as SceneId | null,
  talk: null as SceneId | null,
  bossHp: 0, bossMaxHp: 1, bossActive: false, bossWarning: false,
  paused: false,
  core: freshCore,
  hint: null as Hint | null,
  report: null as RunReport | null,
}

const SOUND_KEY = 'breakline.soundEnabled'
const MUSIC_VOL_KEY = 'breakline.musicVolume'
const SFX_VOL_KEY = 'breakline.sfxVolume'

function loadVolume(key: string): number {
  try {
    const v = parseFloat(localStorage.getItem(key) ?? '')
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
  } catch {
    return 1
  }
}

function saveVolume(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v))
  } catch { /* ignore */ }
}
const HISCORE_KEY = 'breakline.hiScore'

function loadSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

function saveSoundPref(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch { /* ignore */ }
}

function loadHiScore(): number {
  try {
    const v = parseInt(localStorage.getItem(HISCORE_KEY) ?? '0', 10)
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
}

function saveHiScore(n: number) {
  try {
    localStorage.setItem(HISCORE_KEY, String(n))
  } catch { /* ignore */ }
}

export const useGameStore = create<GameState>((set, get) => ({
  ...freshPlay,
  hiScore: loadHiScore(),
  phase: 'title',
  soundEnabled: loadSoundPref(),
  musicVolume: loadVolume(MUSIC_VOL_KEY),
  sfxVolume: loadVolume(SFX_VOL_KEY),
  coreEnabled: true,
  mode: 'arena' as GameMode,

  addScore: (n) => set((s) => {
    const score = s.score + n
    const hiScore = Math.max(score, s.hiScore)
    if (hiScore !== s.hiScore) saveHiScore(hiScore)   // persist each new record
    return { score, hiScore }
  }),
  // Kill scoring: consecutive kills build a chain; its multiplier tier
  // scales every kill's score until the chain lapses (GameApp owns the timer).
  // Every kill path in the game routes through here.
  addKillScore: (base) => {
    let out = { awarded: 0, mult: 1 }
    set((s) => {
      const chain = s.chain + 1
      const mult = chainMult(chain)
      const awarded = base * mult
      out = { awarded, mult }
      const score = s.score + awarded
      const hiScore = Math.max(score, s.hiScore)
      if (hiScore !== s.hiScore) saveHiScore(hiScore)
      return { chain, score, hiScore }
    })
    return out
  },
  resetChain: () => set((s) => (s.chain === 0 ? {} : { chain: 0 })),
  addGraze: () => set((s) => {
    const score = s.score + 50
    const hiScore = Math.max(score, s.hiScore)
    if (hiScore !== s.hiScore) saveHiScore(hiScore)
    return { graze: s.graze + 1, score, hiScore }
  }),
  loseLife: () => set((s) => ({ lives: Math.max(0, s.lives - 1) })),
  addLife: () => set((s) => ({ lives: Math.min(5, s.lives + 1) })),
  setPhase: (phase) => set((s) => {
    // Persist the record at the end of a run
    if (phase === 'gameover' || phase === 'complete' || phase === 'title') saveHiScore(s.hiScore)
    return { phase, paused: false }
  }),
  setCore: (core) => set({ core }),
  setHint: (hint) => set({ hint }),
  setReport: (report) => set({ report }),
  startRun: (mode, coreEnabled) => set((s) => ({
    ...freshPlay,
    hiScore: s.hiScore,
    soundEnabled: s.soundEnabled,
    coreEnabled,
    mode,
    // Story opens on stage 1's briefing; the arena drops straight into play.
    ...(mode === 'story' ? { phase: 'story' as const, storyScene: 'stage1' as const } : {}),
  })),
  playScene: (scene) => set({ phase: 'story', storyScene: scene, paused: false, bossActive: false, bossWarning: false }),
  // No-op branches return the state itself, not {}: zustand skips notifying
  // when the state object is unchanged, while {} would re-render every
  // subscriber for nothing.
  finishScene: () => set((s) => {
    if (s.phase !== 'story') return s
    if (s.storyScene === 'ending') {
      saveHiScore(s.hiScore)
      return { phase: 'complete', storyScene: null }
    }
    return { phase: 'playing', storyScene: null }
  }),
  playTalk: (talk) => set({ talk }),
  finishTalk: () => set((s) => (s.talk ? { talk: null } : s)),
  addBomb: () => {
    if (get().bombs >= BOMB.max) return false
    set((s) => ({ bombs: s.bombs + 1 }))
    return true
  },
  useBomb: () => {
    if (get().bombs <= 0) return false
    set((s) => ({ bombs: s.bombs - 1 }))
    return true
  },
  retryStage: () => set({
    lives: freshPlay.lives, chain: 0, phase: 'playing', paused: false, talk: null,
    bossActive: false, bossWarning: false, report: null,
  }),
  setBossHp: (hp, max) => set({ bossHp: hp, bossMaxHp: max }),
  setBossActive: (v) => set({ bossActive: v }),
  setBossWarning: (v) => set({ bossWarning: v }),
  setMusicVolume: (v) => {
    const musicVolume = Math.min(1, Math.max(0, v))
    saveVolume(MUSIC_VOL_KEY, musicVolume)
    set({ musicVolume })
  },
  setSfxVolume: (v) => {
    const sfxVolume = Math.min(1, Math.max(0, v))
    saveVolume(SFX_VOL_KEY, sfxVolume)
    set({ sfxVolume })
  },
  toggleSound: () => set((s) => {
    const soundEnabled = !s.soundEnabled
    saveSoundPref(soundEnabled)
    return { soundEnabled }
  }),
  togglePause: () => set((s) => {
    // Pausing only makes sense mid-game, and not over a conversation.
    if (s.phase !== 'playing' || s.talk) return s
    return { paused: !s.paused }
  }),
}))

export const gameStore = useGameStore
