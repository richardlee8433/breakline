export type BgTheme = 'space' | 'nebula' | 'asteroid'
export type EnemyPath =
  | 'straight' | 'zigzag' | 'dive' | 'diagonal-left' | 'diagonal-right'
  | 'swoop-left' | 'swoop-right' | 'sine' | 'hover'
export type Formation =
  | 'line-top' | 'line-left' | 'line-right' | 'v-shape'
  | 'arc-left' | 'arc-right' | 'split' | 'pincer'

export interface WaveVariant {
  count?: number
  formation?: Formation
  path?: EnemyPath
  interval?: number
}

export interface WaveEntry {
  time: number
  type: string
  count: number
  formation: Formation
  path: EnemyPath
  /** Seconds between successive members entering. */
  interval?: number
  /**
   * Curated alternatives for this encounter. One is chosen when the wave is
   * scheduled, keeping the stage learnable while stopping repeat runs from
   * being frame-for-frame identical.
   */
  variants?: WaveVariant[]
}

export interface BossConfig {
  shipSprite: string
  displayW: number
  flipY: boolean
  maxHp: number
  speedMult: number
  bulletSpeedMult: number
  fireRateMult: number
  scoreValue: number
}

export interface StageConfig {
  id: number
  bgTheme: BgTheme
  waves: WaveEntry[]
  /** Multiplies every wave's count (neon-raiden's stages ran at 1.5). */
  densityMult: number
  /** With a boss: the time it is called in. Without one, the stage ends
   *  once this time has passed and the field is clear. */
  endTime: number
  boss?: BossConfig
}

// Stage 1 — Deep Space: readable formations, with gentle curved entries.
const stage1: StageConfig = {
  id: 1,
  bgTheme: 'space',
  densityMult: 1.5,
  endTime: 42,
  waves: [
    { time: 1,  type: 'fighter', count: 5, formation: 'line-top', path: 'straight',
      variants: [{ formation: 'split' }, { formation: 'v-shape', path: 'sine' }] },
    { time: 4,  type: 'scout', count: 6, formation: 'arc-left', path: 'swoop-right',
      variants: [{ formation: 'arc-right', path: 'swoop-left' }] },
    { time: 8,  type: 'fighter', count: 4, formation: 'line-left', path: 'dive' },
    { time: 10, type: 'fighter', count: 4, formation: 'line-right', path: 'dive' },
    { time: 14, type: 'bomber', count: 3, formation: 'split', path: 'straight', interval: 0.22 },
    { time: 17, type: 'scout', count: 6, formation: 'v-shape', path: 'sine',
      variants: [{ formation: 'arc-left', path: 'swoop-right' }, { formation: 'arc-right', path: 'swoop-left' }] },
    { time: 21, type: 'scout', count: 7, formation: 'split', path: 'zigzag' },
    { time: 25, type: 'fighter', count: 7, formation: 'pincer', path: 'dive', interval: 0.13,
      variants: [{ path: 'diagonal-left' }, { path: 'diagonal-right' }] },
    { time: 30, type: 'bomber', count: 3, formation: 'line-top', path: 'straight' },
    { time: 33, type: 'scout', count: 6, formation: 'arc-left', path: 'swoop-right',
      variants: [{ formation: 'arc-right', path: 'swoop-left' }, { formation: 'v-shape', path: 'dive' }] },
    { time: 37, type: 'fighter', count: 7, formation: 'split', path: 'sine' },
  ],
  boss: {
    shipSprite: './assets/ships/boss1-dreadnought.png',
    displayW: 300, flipY: false,
    maxHp: 500, speedMult: 1, bulletSpeedMult: 1, fireRateMult: 1, scoreValue: 5000,
  },
}

// Stage 2 — Nebula Field: ambushes, crossfire and delayed pressure.
const stage2: StageConfig = {
  id: 2,
  bgTheme: 'nebula',
  densityMult: 1.5,
  endTime: 46,
  waves: [
    { time: 1, type: 'interceptor', count: 6, formation: 'split', path: 'sine',
      variants: [{ formation: 'v-shape', path: 'dive' }] },
    { time: 4, type: 'fighter', count: 7, formation: 'pincer', path: 'dive', interval: 0.11 },
    { time: 8, type: 'fighter', count: 5, formation: 'line-right', path: 'swoop-left',
      variants: [{ formation: 'line-left', path: 'swoop-right' }] },
    { time: 11, type: 'gunship', count: 2, formation: 'split', path: 'straight', interval: 0.35 },
    { time: 14, type: 'scout', count: 7, formation: 'arc-left', path: 'swoop-right',
      variants: [{ formation: 'arc-right', path: 'swoop-left' }] },
    { time: 18, type: 'interceptor', count: 7, formation: 'pincer', path: 'dive' },
    { time: 21, type: 'bomber', count: 3, formation: 'line-top', path: 'straight' },
    { time: 24, type: 'gunship', count: 3, formation: 'split', path: 'straight' },
    { time: 27, type: 'interceptor', count: 6, formation: 'line-left', path: 'swoop-right',
      variants: [{ formation: 'line-right', path: 'swoop-left' }, { formation: 'pincer', path: 'dive' }] },
    { time: 31, type: 'scout', count: 8, formation: 'split', path: 'zigzag' },
    { time: 34, type: 'bomber', count: 4, formation: 'v-shape', path: 'straight' },
    { time: 38, type: 'interceptor', count: 8, formation: 'pincer', path: 'dive', interval: 0.10 },
    { time: 42, type: 'gunship', count: 3, formation: 'arc-left', path: 'swoop-right',
      variants: [{ formation: 'arc-right', path: 'swoop-left' }] },
  ],
  boss: {
    shipSprite: './assets/ships/boss2-cruiser.png',
    displayW: 235, flipY: true,
    maxHp: 600, speedMult: 1.3, bulletSpeedMult: 1.25, fireRateMult: 0.8, scoreValue: 8000,
  },
}

// Stage 3 — Asteroid Belt: overlapping formations and less predictable attack geometry.
const stage3: StageConfig = {
  id: 3,
  bgTheme: 'asteroid',
  densityMult: 1.5,
  endTime: 44,
  waves: [
    { time: 1, type: 'elite', count: 7, formation: 'arc-left', path: 'swoop-right',
      variants: [{ formation: 'arc-right', path: 'swoop-left' }, { formation: 'split', path: 'sine' }] },
    { time: 4, type: 'elite', count: 7, formation: 'pincer', path: 'dive', interval: 0.10 },
    { time: 7, type: 'carrier', count: 2, formation: 'split', path: 'straight' },
    { time: 10, type: 'interceptor', count: 7, formation: 'v-shape', path: 'sine',
      variants: [{ formation: 'pincer', path: 'dive' }] },
    { time: 13, type: 'scout', count: 7, formation: 'arc-right', path: 'swoop-left' },
    { time: 16, type: 'carrier', count: 3, formation: 'line-top', path: 'straight' },
    { time: 18, type: 'elite', count: 6, formation: 'line-left', path: 'swoop-right' },
    { time: 19, type: 'elite', count: 6, formation: 'line-right', path: 'swoop-left' },
    { time: 23, type: 'gunship', count: 4, formation: 'split', path: 'straight' },
    { time: 26, type: 'interceptor', count: 8, formation: 'pincer', path: 'dive', interval: 0.09,
      variants: [{ formation: 'split', path: 'sine' }] },
    { time: 29, type: 'bomber', count: 4, formation: 'v-shape', path: 'straight' },
    { time: 32, type: 'carrier', count: 3, formation: 'arc-left', path: 'swoop-right',
      variants: [{ formation: 'arc-right', path: 'swoop-left' }] },
    { time: 35, type: 'elite', count: 8, formation: 'split', path: 'dive' },
    { time: 38, type: 'interceptor', count: 7, formation: 'pincer', path: 'sine' },
    { time: 41, type: 'carrier', count: 3, formation: 'v-shape', path: 'straight' },
  ],
  boss: {
    shipSprite: './assets/ships/boss3-fortress.png',
    displayW: 310, flipY: true,
    maxHp: 850, speedMult: 1.6, bulletSpeedMult: 1.5, fireRateMult: 0.65, scoreValue: 12000,
  },
}

// Phase 1 combat arena: introduce each rule alone, then mix them.
// Energy drones first (absorb), missiles alone (the contrast), then both.
const arena: StageConfig = {
  id: 1,
  bgTheme: 'space',
  densityMult: 1,
  endTime: 70,
  waves: [
    // absorb: sparse drones holding station
    { time: 1,  type: 'drone', count: 2, formation: 'line-top', path: 'hover', interval: 0.4 },
    { time: 9,  type: 'drone', count: 3, formation: 'v-shape', path: 'hover' },
    // contrast: missiles on their own
    { time: 18, type: 'missileer', count: 1, formation: 'line-top', path: 'hover' },
    { time: 25, type: 'missileer', count: 2, formation: 'split', path: 'hover' },
    // mixed
    { time: 33, type: 'drone', count: 3, formation: 'line-top', path: 'hover' },
    { time: 35, type: 'missileer', count: 1, formation: 'line-top', path: 'hover' },
    { time: 42, type: 'drone', count: 4, formation: 'arc-left', path: 'swoop-right',
      variants: [{ formation: 'arc-right', path: 'swoop-left' }] },
    { time: 44, type: 'missileer', count: 2, formation: 'split', path: 'hover' },
    { time: 52, type: 'drone', count: 4, formation: 'v-shape', path: 'hover' },
    { time: 54, type: 'missileer', count: 2, formation: 'split', path: 'hover' },
    { time: 58, type: 'drone', count: 3, formation: 'split', path: 'sine' },
  ],
}

export const ARENA: StageConfig = arena

// ── Story mode: three stages, each ending in a boss (game plan §8) ─────────
// Stage 1 is the arena's teaching order capped by the interceptor boss.
// Stages 2–3 reuse neon-raiden's stage 2–3 waves, with missile interceptors
// threaded in so the absorb/dodge choice stays live after the tutorial.
// Bosses reuse neon-raiden's art until part-based bosses exist (Phase 2):
// 1 Helion interceptor, 2 ancient guardian, 3 Helion blockade flagship.
const missiles = (times: number[], count = 1): WaveEntry[] =>
  times.map((time, i) => ({
    time, type: 'missileer', count,
    formation: i % 2 ? 'split' : 'line-top', path: 'hover',
  }))
const byTime = (waves: WaveEntry[]) => [...waves].sort((a, b) => a.time - b.time)

export const STORY_STAGES: StageConfig[] = [
  { ...arena, id: 1, endTime: 64, boss: stage1.boss },
  { ...stage2, densityMult: 1.2, waves: byTime([...stage2.waves, ...missiles([6, 20, 36])]) },
  { ...stage3, densityMult: 1.2, waves: byTime([...stage3.waves, ...missiles([5, 17, 30, 40], 2)]) },
]

export type GameMode = 'story' | 'arena'

/** The stage config a mode runs at a given (1-based) stage number. */
export function stageConfig(mode: GameMode, stage: number): StageConfig {
  if (mode === 'arena') return ARENA
  return STORY_STAGES[Math.min(Math.max(stage, 1), STORY_STAGES.length) - 1]
}
