import { create } from 'zustand'
import { STAGES } from '../game/data/stages'

/** Chain length → score multiplier tier. */
export function chainMult(chain: number): number {
  return chain >= 20 ? 8 : chain >= 10 ? 4 : chain >= 5 ? 2 : 1
}

export type WeaponType = 'vulcan' | 'laser' | 'plasma'

interface GameState {
  score: number
  hiScore: number
  graze: number
  chain: number
  loop: number   // playthrough number; enemies get faster each loop
  lives: number
  power: number
  laserPower: number
  plasmaPower: number
  weapon: WeaponType
  stage: number
  phase: 'title' | 'playing' | 'stageclear' | 'advancing' | 'gameover'
  bossHp: number
  bossMaxHp: number
  bossActive: boolean
  bossWarning: boolean
  soundEnabled: boolean
  paused: boolean

  addScore: (n: number) => void
  addKillScore: (base: number) => { awarded: number; mult: number }
  resetChain: () => void
  addGraze: () => void
  loseLife: () => void
  addLife: () => void
  addPower: (n: number) => void
  addLaserPower: () => void
  addPlasmaPower: () => void
  dropPower: () => void
  setPhase: (p: GameState['phase']) => void
  setBossHp: (hp: number, max: number) => void
  setBossActive: (v: boolean) => void
  setBossWarning: (v: boolean) => void
  advanceStage: () => void
  toggleSound: () => void
  togglePause: () => void
  reset: (keepHi?: boolean) => void
}

const freshPlay = {
  score: 0, graze: 0, chain: 0, loop: 1,
  lives: 3, power: 0, laserPower: 0, plasmaPower: 0,
  weapon: 'vulcan' as WeaponType,
  stage: 1, phase: 'playing' as const,
  bossHp: 0, bossMaxHp: 1, bossActive: false, bossWarning: false,
  paused: false,
}

const SOUND_KEY = 'breakline.soundEnabled'
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
  addPower: (n) => set((s) => ({
    weapon: 'vulcan',
    power: Math.min(4, s.power + n),
  })),
  addLaserPower: () => set((s) => ({
    weapon: 'laser',
    laserPower: Math.min(5, s.laserPower + 1),
  })),
  addPlasmaPower: () => set((s) => ({
    weapon: 'plasma',
    plasmaPower: Math.min(4, s.plasmaPower + 1),
  })),
  // death penalty: lose two weapon levels (some scatter as recoverable pickups)
  dropPower: () => set((s) => (
    s.weapon === 'laser'  ? { laserPower: Math.max(1, s.laserPower - 2) }
  : s.weapon === 'plasma' ? { plasmaPower: Math.max(0, s.plasmaPower - 2) }
                          : { power: Math.max(0, s.power - 2) }
  )),
  setPhase: (phase) => set((s) => {
    // Persist the record at the end of a run
    if (phase === 'gameover' || phase === 'title') saveHiScore(s.hiScore)
    return { phase, paused: false }
  }),
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
  toggleSound: () => set((s) => {
    const soundEnabled = !s.soundEnabled
    saveSoundPref(soundEnabled)
    return { soundEnabled }
  }),
  togglePause: () => set((s) => {
    if (s.phase !== 'playing') return {}   // pausing only makes sense mid-game
    return { paused: !s.paused }
  }),
  reset: (keepHi = true) => set((s) => ({
    ...freshPlay,
    hiScore: keepHi ? s.hiScore : 0,
    soundEnabled: s.soundEnabled,
  })),
}))

export const gameStore = useGameStore
