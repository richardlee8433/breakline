import { create } from 'zustand'
import { STAGES } from '../game/data/stages'

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
}

const freshCore: CoreView = {
  energy: 0, heat: 0, overheated: false, absorbing: false,
  absorbCharge: 1, dashCharge: 1, catchSerial: 0,
}

export type HitCause = 'energy' | 'missile' | 'hull' | 'beam'

/**
 * One run's playtest metrics (game plan §14): enough to spot side-hits
 * while absorbing, whiffed windows, dead time while overheated, and energy
 * left sitting unspent.
 */
export interface RunReport {
  mode: 'core' | 'control'
  cleared: boolean
  seconds: number
  score: number
  windows: number        // absorb windows opened
  whiffs: number         // windows that caught nothing
  catches: number        // rounds absorbed
  counters: number       // counter shots fired
  counterKills: number   // enemies killed by counter pulses
  overheats: number
  overheatSeconds: number
  readyIdleSeconds: number  // time spent with a counter affordable but unused
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
  stage: number
  phase: 'title' | 'playing' | 'stageclear' | 'advancing' | 'gameover' | 'complete'
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
  startRun: (coreEnabled: boolean) => void
  setBossHp: (hp: number, max: number) => void
  setBossActive: (v: boolean) => void
  setBossWarning: (v: boolean) => void
  advanceStage: () => void
  toggleSound: () => void
  setMusicVolume: (v: number) => void
  setSfxVolume: (v: number) => void
  togglePause: () => void
}

const freshPlay = {
  score: 0, graze: 0, chain: 0, loop: 1,
  lives: 3,
  stage: 1, phase: 'playing' as const,
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
  startRun: (coreEnabled) => set((s) => ({
    ...freshPlay,
    hiScore: s.hiScore,
    soundEnabled: s.soundEnabled,
    coreEnabled,
  })),
  setBossHp: (hp, max) => set({ bossHp: hp, bossMaxHp: max }),
  setBossActive: (v) => set({ bossActive: v }),
  setBossWarning: (v) => set({ bossWarning: v }),
  advanceStage: () => set((s) => {
    // past the last stage: wrap into the next loop (harder playthrough)
    const wrap = s.stage >= STAGES.length
    return {
      stage: wrap ? 1 : s.stage + 1,
      loop: wrap ? s.loop + 1 : s.loop,
      phase: 'advancing',
      bossActive: false,
    }
  }),
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
    if (s.phase !== 'playing') return {}   // pausing only makes sense mid-game
    return { paused: !s.paused }
  }),
}))

export const gameStore = useGameStore
