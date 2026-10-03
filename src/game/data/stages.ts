// Chase stages (docs/Breakline_Chase_Prototype_Design_v0.2.txt §6–8).
// A stage is won by surviving its duration; nothing has to be destroyed.
// Prototype lengths are 2 / 3 / 4 minutes (the design's 3 / 5 / 8, cut down
// until the pacing is proven); each timeline keeps the design's phases at
// the same share of the stage.

import { TIME_SCALE } from '../config'
import type { RockSize } from './chase'

export type BgTheme = 'space' | 'nebula' | 'asteroid'

/** Where a wave's pursuers come in along the bottom edge. */
export type Lane = 'center' | 'left' | 'right' | 'spread'

export interface ChaseWave {
  /** Seconds into the stage. */
  time: number
  /** Key into ENEMIES. */
  type: string
  count: number
  lane: Lane
}

/**
 * A stretch of asteroid field. Rocks come in rows; every row leaves one
 * clear lane at least `gap` wide, and the lane moves at most `drift` per
 * row, so the way through is always reachable at the ship's speed (rows are
 * spaced far enough apart to cross between them).
 */
export interface RockSegment {
  from: number
  to: number
  /** Seconds between rows. */
  every: number
  /** 0–1: how much of each row (outside the lane) holds rocks. */
  fill: number
  /** Relative odds of small / medium / large. */
  sizes: Record<RockSize, number>
  /** Clear lane width, base px. */
  gap: number
  /** Most the clear lane shifts from one row to the next, base px. */
  drift: number
}

/** single: one mine. pair: two side by side. gate: a row across the field
 *  with one wide opening at x. triangle: three in a wedge. */
export type MinePattern = 'single' | 'pair' | 'gate' | 'triangle'

export interface MineWave {
  time: number
  pattern: MinePattern
  /** 0–1 across the playfield: the mine (single), the pattern's center,
   *  or the gate's opening. */
  x: number
}

export interface StageConfig {
  id: number
  bgTheme: BgTheme
  /** Seconds to survive. */
  duration: number
  /** HUD objective line. */
  mission: string
  waves: ChaseWave[]
  rocks?: RockSegment[]
  mines?: MineWave[]
  /** Stage 3: the clock is the jump drive charging; ends in the jump. */
  jump?: boolean
  /** Seconds before the end when the last interception (and its music)
   *  begins. */
  finale?: number
}

const w = (time: number, type: string, count: number, lane: Lane): ChaseWave =>
  ({ time, type, count, lane })
const m = (time: number, pattern: MinePattern, x: number): MineWave => ({ time, pattern, x })

// Stage 1 — patrol pursuit, 120 s. Reach the asteroid belt entrance.
//   0–20   energy drones, the first missile patrol early
//   20–50  missile patrols alternate with drones: what can't be absorbed
//   50–90  mixed pursuers changing lanes: when to spend the EMP
//   90–120 heavier pursuit, still with gaps, up to the entrance
const stage1: StageConfig = {
  id: 1,
  bgTheme: 'space',
  duration: 120,
  mission: '抵達小行星帶入口',
  waves: [
    w(2, 'drone', 1, 'center'),
    w(7, 'drone', 2, 'spread'),
    w(12, 'missileer', 1, 'center'),
    w(17, 'drone', 2, 'left'),
    w(22, 'missileer', 1, 'right'),
    w(27, 'drone', 2, 'right'),
    w(31, 'missileer', 2, 'spread'),
    w(37, 'drone', 2, 'spread'),
    w(41, 'missileer', 1, 'left'),
    w(46, 'drone', 3, 'spread'),
    w(50, 'missileer', 2, 'spread'),
    w(56, 'drone', 2, 'left'),
    w(59, 'missileer', 2, 'spread'),
    w(65, 'drone', 3, 'spread'),
    w(69, 'missileer', 2, 'spread'),
    w(75, 'drone', 2, 'right'),
    w(78, 'missileer', 1, 'center'),
    w(84, 'drone', 3, 'spread'),
    w(87, 'missileer', 2, 'spread'),
    w(93, 'drone', 2, 'center'),
    w(96, 'missileer', 3, 'spread'),
    w(102, 'drone', 3, 'spread'),
    w(105, 'missileer', 2, 'spread'),
    w(110, 'drone', 2, 'spread'),
    w(112, 'missileer', 2, 'spread'),
  ],
}

// Stage 2 — the asteroid shortcut, 180 s. Rocks ahead, pursuers behind
// from the first seconds.
//   0–36    a busy field of small and medium rocks: learn the markers
//   36–90   denser, the clear lane drifts more
//   90–108  a lighter stretch…
//   108–126 …then big rocks
//   126–162 the densest part (rocks never close every lane)
//   162–180 the field thins out toward the exit
// Every `drift` stays below `gap` minus the ship's width, so consecutive
// lanes always overlap by more than the ship: the way through never asks
// for a sideways dash between rows.
const stage2: StageConfig = {
  id: 2,
  bgTheme: 'asteroid',
  duration: 180,
  mission: '穿越小行星帶',
  rocks: [
    { from: 1,   to: 36,  every: 1.4,  fill: 0.8,  sizes: { small: 5, medium: 4, large: 1 }, gap: 200, drift: 60 },
    { from: 36,  to: 90,  every: 1.2,  fill: 0.85, sizes: { small: 3, medium: 4, large: 2 }, gap: 185, drift: 70 },
    { from: 90,  to: 108, every: 1.6,  fill: 0.65, sizes: { small: 5, medium: 3, large: 0 }, gap: 200, drift: 50 },
    { from: 108, to: 126, every: 1.35, fill: 0.9,  sizes: { small: 1, medium: 3, large: 4 }, gap: 185, drift: 60 },
    { from: 126, to: 162, every: 1.15, fill: 0.9,  sizes: { small: 3, medium: 4, large: 2 }, gap: 175, drift: 75 },
    { from: 162, to: 176, every: 1.6,  fill: 0.6,  sizes: { small: 5, medium: 2, large: 0 }, gap: 200, drift: 50 },
  ],
  waves: [
    w(3, 'drone', 1, 'center'),
    w(8, 'drone', 2, 'spread'),
    w(13, 'missileer', 1, 'center'),
    w(19, 'drone', 2, 'left'),
    w(24, 'missileer', 1, 'right'),
    w(30, 'drone', 2, 'spread'),
    w(35, 'missileer', 1, 'left'),
    w(40, 'drone', 2, 'spread'),
    w(44, 'missileer', 2, 'spread'),
    w(50, 'drone', 2, 'left'),
    w(55, 'missileer', 1, 'right'),
    w(60, 'drone', 3, 'spread'),
    w(65, 'missileer', 2, 'spread'),
    w(71, 'drone', 2, 'right'),
    w(76, 'missileer', 1, 'center'),
    w(82, 'drone', 3, 'spread'),
    w(86, 'missileer', 2, 'spread'),
    w(92, 'drone', 2, 'center'),
    w(98, 'drone', 2, 'spread'),
    w(104, 'missileer', 1, 'center'),
    w(110, 'drone', 2, 'right'),
    w(115, 'missileer', 2, 'spread'),
    w(121, 'drone', 3, 'spread'),
    w(126, 'missileer', 2, 'spread'),
    w(132, 'drone', 2, 'left'),
    w(137, 'missileer', 1, 'right'),
    w(143, 'drone', 3, 'spread'),
    w(148, 'missileer', 2, 'spread'),
    w(154, 'drone', 2, 'spread'),
    w(159, 'missileer', 2, 'spread'),
    w(165, 'drone', 2, 'spread'),
    w(170, 'missileer', 1, 'center'),
  ],
}

// Stage 3 — the mine blockade, 240 s. Hold on while the jump drive charges.
//   0–45    single mines: the one-second fuse
//   45–90   mine groups + the usual pursuers
//   90–135  guided missile ships
//   135–165 a breather, energy still on offer
//   165–210 EMP-hardened pursuers: time the pulse
//   210–240 Thorne's last interception, still with a way through
const stage3: StageConfig = {
  id: 3,
  bgTheme: 'nebula',
  duration: 240,
  mission: '撐到跳躍裝置充能完成',
  jump: true,
  finale: 30,
  mines: [
    m(4, 'single', 0.5), m(10, 'single', 0.3), m(16, 'single', 0.7), m(22, 'pair', 0.5),
    m(30, 'single', 0.4), m(36, 'pair', 0.6), m(42, 'single', 0.5),
    m(48, 'triangle', 0.5), m(55, 'gate', 0.3), m(62, 'pair', 0.7), m(68, 'gate', 0.7),
    m(75, 'triangle', 0.4), m(82, 'gate', 0.5), m(88, 'pair', 0.3),
    m(95, 'single', 0.5), m(101, 'pair', 0.4), m(108, 'gate', 0.6), m(115, 'triangle', 0.5),
    m(122, 'pair', 0.7), m(129, 'gate', 0.4),
    m(140, 'single', 0.5), m(152, 'single', 0.3), m(160, 'pair', 0.5),
    m(168, 'gate', 0.5), m(175, 'triangle', 0.3), m(182, 'pair', 0.6), m(189, 'gate', 0.4),
    m(196, 'triangle', 0.7), m(203, 'pair', 0.5),
    m(212, 'gate', 0.6), m(218, 'triangle', 0.4), m(224, 'gate', 0.3), m(230, 'pair', 0.5),
  ],
  waves: [
    w(3, 'drone', 1, 'center'),
    w(12, 'drone', 2, 'spread'),
    w(25, 'drone', 2, 'left'),
    w(35, 'missileer', 1, 'right'),
    w(47, 'drone', 2, 'spread'),
    w(52, 'missileer', 1, 'center'),
    w(60, 'drone', 2, 'right'),
    w(66, 'missileer', 2, 'spread'),
    w(74, 'drone', 3, 'spread'),
    w(80, 'missileer', 1, 'left'),
    w(86, 'drone', 2, 'spread'),
    w(92, 'guided', 1, 'center'),
    w(98, 'drone', 2, 'spread'),
    w(105, 'guided', 1, 'left'),
    w(110, 'drone', 2, 'right'),
    w(116, 'guided', 2, 'spread'),
    w(123, 'drone', 3, 'spread'),
    w(128, 'missileer', 1, 'center'),
    w(137, 'drone', 2, 'spread'),
    w(145, 'drone', 2, 'left'),
    w(155, 'drone', 3, 'spread'),
    w(166, 'hardened', 1, 'center'),
    w(170, 'drone', 2, 'spread'),
    w(176, 'hardened', 1, 'right'),
    w(182, 'guided', 1, 'left'),
    w(188, 'drone', 3, 'spread'),
    w(194, 'hardened', 2, 'spread'),
    w(200, 'missileer', 1, 'center'),
    w(205, 'drone', 2, 'spread'),
    w(211, 'hardened', 2, 'spread'),
    w(213, 'drone', 3, 'spread'),
    w(217, 'guided', 2, 'spread'),
    w(223, 'missileer', 2, 'spread'),
    w(226, 'drone', 2, 'spread'),
    w(229, 'hardened', 2, 'spread'),
    w(233, 'guided', 1, 'center'),
  ],
}

/** The story's stages in order. */
export const STORY_STAGES: StageConfig[] = [stage1, stage2, stage3]
/** How many stages the finished story will have. */
export const STORY_LENGTH = 3

/** 'trial' plays one stage with no dialog, for quick playtests. */
export type GameMode = 'story' | 'trial'

/** The config for a (1-based) stage, with the dev time scale applied. */
export function stageConfig(stage: number): StageConfig {
  const base = STORY_STAGES[Math.min(Math.max(stage, 1), STORY_STAGES.length) - 1]
  if (TIME_SCALE === 1) return base
  const k = TIME_SCALE
  return {
    ...base,
    duration: base.duration * k,
    finale: base.finale && base.finale * k,
    waves: base.waves.map((x) => ({ ...x, time: x.time * k })),
    mines: base.mines?.map((x) => ({ ...x, time: x.time * k })),
    // Only the timeline is compressed; row spacing stays physical so the
    // way through is still reachable.
    rocks: base.rocks?.map((x) => ({ ...x, from: x.from * k, to: x.to * k })),
  }
}
