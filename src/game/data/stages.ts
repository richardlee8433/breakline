// Chase stages (docs/Breakline_Chase_Prototype_Design_v0.2.txt §6–8).
// A stage is won by surviving its duration; nothing has to be destroyed.
// Prototype lengths are 2 / 3 / 4 minutes (the design's 3 / 5 / 8, cut down
// until the pacing is proven).

import { TIME_SCALE } from '../config'

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

export interface StageConfig {
  id: number
  bgTheme: BgTheme
  /** Seconds to survive. */
  duration: number
  /** HUD objective line. */
  mission: string
  waves: ChaseWave[]
}

const w = (time: number, type: string, count: number, lane: Lane): ChaseWave =>
  ({ time, type, count, lane })

// Stage 1 — patrol pursuit, 120 s. Reach the asteroid belt entrance.
//   0–20   energy drones only: the field and the EMP gauge
//   20–50  single missile patrols with a lock warning: what can't be absorbed
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
    w(14, 'drone', 2, 'left'),
    w(21, 'missileer', 1, 'center'),
    w(27, 'drone', 2, 'right'),
    w(33, 'missileer', 1, 'left'),
    w(38, 'drone', 2, 'spread'),
    w(44, 'missileer', 1, 'right'),
    w(51, 'drone', 3, 'spread'),
    w(55, 'missileer', 2, 'spread'),
    w(63, 'drone', 2, 'left'),
    w(67, 'missileer', 1, 'center'),
    w(72, 'drone', 3, 'spread'),
    w(78, 'missileer', 2, 'spread'),
    w(84, 'drone', 2, 'right'),
    w(91, 'drone', 3, 'spread'),
    w(94, 'missileer', 2, 'spread'),
    w(100, 'drone', 2, 'center'),
    w(103, 'missileer', 2, 'spread'),
    w(108, 'drone', 3, 'spread'),
    w(111, 'missileer', 1, 'center'),
  ],
}

/** The story's stages in order. Stages 2 (asteroid shortcut) and 3 (mine
 *  blockade) are not built yet; the story stops after the last one here. */
export const STORY_STAGES: StageConfig[] = [stage1]
/** How many stages the finished story will have. */
export const STORY_LENGTH = 3

/** 'trial' plays one stage with no dialog, for quick playtests. */
export type GameMode = 'story' | 'trial'

/** The config for a (1-based) stage, with the dev time scale applied. */
export function stageConfig(stage: number): StageConfig {
  const base = STORY_STAGES[Math.min(Math.max(stage, 1), STORY_STAGES.length) - 1]
  if (TIME_SCALE === 1) return base
  return {
    ...base,
    duration: base.duration * TIME_SCALE,
    waves: base.waves.map((wv) => ({ ...wv, time: wv.time * TIME_SCALE })),
  }
}
