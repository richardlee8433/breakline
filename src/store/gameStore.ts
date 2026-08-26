import { create } from 'zustand'
import { STAGES } from '../game/data/stages'
import {
  BURST_MAX, BURST_GAIN_PER_GRAZE, BURST_DEATH_RETAIN,
  MAX_BURST_LEVEL, burstGainForKill, burstTier,
} from '../game/data/burst'

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
  burst: number       // BURST gauge, 0–BURST_MAX; fed by kills and grazes
  burstLevel: number  // 0 = idle, 1 = BURST, 2 = DOUBLE BURST
  loop: number   // playthrough number; enemies get faster each loop
  lives: number
  bombs: number
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
  addBurst: (n: number) => void
  drainBurst: (dt: number) => void
  igniteBurst: () => number
  endBurst: () => void
  loseLife: () => void
  addLife: () => void
  addPower: (n: number) => void
  addLaserPower: () => void
  addPlasmaPower: () => void
  dropPower: () => void
  useBomb: () => boolean
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
  score: 0, graze: 0, chain: 0, burst: 0, burstLevel: 0, loop: 1,
  lives: 3, bombs: 3, power: 0, laserPower: 0, plasmaPower: 0,
  weapon: 'vulcan' as WeaponType,
  stage: 1, phase: 'playing' as const,
  bossHp: 0, bossMaxHp: 1, bossActive: false, bossWarning: false,
  paused: false,
}

const SOUND_KEY = 'raiden.soundEnabled'
const HISCORE_KEY = 'raiden.hiScore'

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
  // An active BURST stacks its own multiplier on top, and every kill feeds
  // the gauge — so aggression pays for the next burst while cashing in the
  // current one. Every kill path in the game routes through here.
  addKillScore: (base) => {
    let out = { awarded: 0, mult: 1 }
    set((s) => {
      const chain = s.chain + 1
      const mult = chainMult(chain) * burstTier(s.burstLevel).scoreMult
      const awarded = base * mult
      out = { awarded, mult }
      const score = s.score + awarded
      const hiScore = Math.max(score, s.hiScore)
      if (hiScore !== s.hiScore) saveHiScore(hiScore)
      const burst = Math.min(BURST_MAX, s.burst + burstGainForKill(base))
      return { chain, score, hiScore, burst }
    })
    return out
  },
  resetChain: () => set((s) => (s.chain === 0 ? {} : { chain: 0 })),
  // Grazing is now the fastest way to charge BURST, which is the whole point:
  // it turns "fly close to bullets" from a flat score trickle into the engine
  // that drives the game's power spike.
  addGraze: () => set((s) => {
    const score = s.score + 50
    const hiScore = Math.max(score, s.hiScore)
    if (hiScore !== s.hiScore) saveHiScore(hiScore)
    return {
      graze: s.graze + 1, score, hiScore,
      burst: Math.min(BURST_MAX, s.burst + BURST_GAIN_PER_GRAZE),
    }
  }),
  addBurst: (n) => set((s) => ({ burst: Math.min(BURST_MAX, Math.max(0, s.burst + n)) })),
  // The gauge doubles as the burst's fuel: while one is running it drains,
  // and kills/grazes top it back up, so a strong run extends its own window.
  drainBurst: (dt) => set((s) => {
    if (s.burstLevel === 0) return {}
    const burst = s.burst - burstTier(s.burstLevel).drainPerSec * dt
    if (burst <= 0) return { burst: 0, burstLevel: 0 }
    return { burst }
  }),
  /** Spend a full gauge to start a burst, or upgrade a running one.
   *  Returns the new level, or 0 if the gauge wasn't full. */
  igniteBurst: () => {
    const s = get()
    if (s.burst < BURST_MAX) return 0
    if (s.burstLevel >= MAX_BURST_LEVEL) return 0
    const burstLevel = s.burstLevel + 1
    // The full gauge becomes the new tier's fuel rather than being consumed,
    // so upgrading to DOUBLE BURST refreshes the window instead of ending it.
    set({ burstLevel, burst: BURST_MAX })
    return burstLevel
  },
  /** Stop an active burst but keep the charge — used on stage transitions,
   *  where ending the run's momentum is fair but confiscating it isn't. */
  endBurst: () => set((s) => (s.burstLevel === 0 ? {} : { burstLevel: 0 })),
  loseLife: () => set((s) => ({
    lives: Math.max(0, s.lives - 1),
    burstLevel: 0,
    burst: s.burst * BURST_DEATH_RETAIN,
  })),
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
  useBomb: () => {
    if (get().bombs <= 0) return false
    set((s) => ({ bombs: Math.max(0, s.bombs - 1) }))
    return true
  },
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
