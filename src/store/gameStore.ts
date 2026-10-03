import { create } from 'zustand'
import { STORY_STAGES, STORY_LENGTH, type GameMode } from '../game/data/stages'
import { introFor, type SceneId, type Speaker } from '../game/data/story'
import { HULL, LIVES } from '../game/data/chase'

/** HUD-facing mirror of the core, written by GameApp at a throttled rate. */
export interface CoreView {
  energy: number        // 0–100
  ready: boolean        // EMP can fire now
  empCharge: number     // 0 = just fired, 1 = minimum gap over
  catchSerial: number   // bumps on each absorbed round; drives the gauge pulse
}

const freshCore: CoreView = { energy: 0, ready: false, empCharge: 1, catchSerial: 0 }

/** What cost the ship a point of hull. */
export type HitCause = 'missile' | 'ram' | 'rock' | 'mine'

/**
 * One stage attempt's playtest metrics (design v0.2 §12): enough to see
 * whether players read "absorb energy, dodge solids", whether the EMP buys
 * distance, and whether standing still is enough to survive.
 */
export interface StageReport {
  stage: number
  mode: GameMode
  cleared: boolean
  /** What took the last life (game over), else null. */
  fatal: HitCause | null
  /** Cleared stages only: integrity and lives turned into points. */
  score: number
  integrity: number      // hull left as a percentage
  livesLeft: number
  seconds: number        // time survived
  duration: number       // the stage's length
  hullLeft: number
  hits: Record<HitCause, number>
  rounds: number         // energy rounds absorbed
  banked: number         // energy actually stored
  wasted: number         // energy lost to the banking limit or a full gauge
  emps: number
  disabled: number       // pursuers knocked out by EMPs
  shaken: number         // of those, left behind for good
  wrecked: number        // pursuers lost to rocks
  stillPct: number       // share of the stage spent not moving
}

/** A short in-combat radio line or prompt. Never pauses the chase. */
export interface Hint { id: number; text: string; tone: 'info' | 'warn'; who?: Speaker }

interface GameState {
  /** title → (story ↔ playing → stageclear)… → complete | gameover */
  phase: 'title' | 'story' | 'playing' | 'stageclear' | 'gameover' | 'complete'
  mode: GameMode
  stage: number
  /** The dialog playing while phase is 'story'. */
  storyScene: SceneId | null
  /** A short in-combat conversation. Combat pauses under it. */
  talk: SceneId | null
  hull: number
  /** Lives left in this run (LIVES.start at the start of each run). */
  lives: number
  /** Lives when the current stage began: a restart from the pause menu
   *  goes back to this, a retry after game over to a full LIVES.start. */
  livesAtStage: number
  /** Score per cleared stage in this run, by stage number. */
  stageScores: Record<number, number>
  /** Whole seconds left in the stage (rounded up). */
  timeLeft: number
  /** The stage's full length, for the progress readouts. */
  duration: number
  core: CoreView
  hint: Hint | null
  report: StageReport | null
  soundEnabled: boolean
  /** 0–1, multiplied into every music / sfx level. Persisted locally. */
  musicVolume: number
  sfxVolume: number
  paused: boolean
  /** Bumped by every restart of a stage, so a restart from the pause menu
   *  (already 'playing') still reloads the stage. */
  runSerial: number

  setPhase: (p: GameState['phase']) => void
  setCore: (c: CoreView) => void
  setHull: (n: number) => void
  /** Spend a life; returns how many are left. */
  loseLife: () => number
  markStageStart: () => void
  setStageScore: (stage: number, score: number) => void
  setClock: (timeLeft: number, duration: number) => void
  setHint: (h: Hint | null) => void
  setReport: (r: StageReport | null) => void
  /** Story from the start, or a trial of one stage. */
  startRun: (mode: GameMode, stage?: number) => void
  /** Play a story scene (combat waits until it finishes). */
  playScene: (scene: SceneId) => void
  /** The current scene ended or was skipped. */
  finishScene: () => void
  /** After a loss, a cleared trial, or from the pause menu: the same stage
   *  again from the top, no dialog. */
  retryStage: () => void
  /** Story, from the stage-clear results: on to the next briefing. */
  continueRun: () => void
  playTalk: (scene: SceneId) => void
  finishTalk: () => void
  toggleSound: () => void
  setMusicVolume: (v: number) => void
  setSfxVolume: (v: number) => void
  togglePause: () => void
  /** The tab was hidden: pause so time can't be skipped by switching away. */
  autoPause: () => void
}

const freshPlay = {
  stage: 1,
  phase: 'playing' as GameState['phase'],
  storyScene: null as SceneId | null,
  talk: null as SceneId | null,
  hull: HULL.max,
  lives: LIVES.start,
  livesAtStage: LIVES.start,
  stageScores: {} as Record<number, number>,
  timeLeft: 0,
  duration: 1,
  paused: false,
  runSerial: 0,
  core: freshCore,
  hint: null as Hint | null,
  report: null as StageReport | null,
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

export const useGameStore = create<GameState>((set, get) => ({
  ...freshPlay,
  phase: 'title',
  mode: 'story' as GameMode,
  soundEnabled: loadSoundPref(),
  musicVolume: loadVolume(MUSIC_VOL_KEY),
  sfxVolume: loadVolume(SFX_VOL_KEY),

  setPhase: (phase) => set({ phase, paused: false }),
  setCore: (core) => set({ core }),
  setHull: (hull) => set((s) => (s.hull === hull ? s : { hull })),
  loseLife: () => {
    set((s) => ({ lives: Math.max(0, s.lives - 1) }))
    return get().lives
  },
  markStageStart: () => set((s) => (s.livesAtStage === s.lives ? s : { livesAtStage: s.lives })),
  setStageScore: (stage, score) => set((s) => ({ stageScores: { ...s.stageScores, [stage]: score } })),
  setClock: (timeLeft, duration) => set((s) =>
    (s.timeLeft === timeLeft && s.duration === duration ? s : { timeLeft, duration })),
  setHint: (hint) => set({ hint }),
  setReport: (report) => set({ report }),
  startRun: (mode, stage = 1) => set((s) => ({
    ...freshPlay,
    soundEnabled: s.soundEnabled,
    mode,
    stage,
    runSerial: s.runSerial + 1,
    // Story opens on stage 1's briefing; a trial drops straight into play.
    ...(mode === 'story' ? { phase: 'story' as const, storyScene: 'stage1' as const } : {}),
  })),
  playScene: (scene) => set({ phase: 'story', storyScene: scene, paused: false, talk: null }),
  // No-op branches return the state itself, not {}: zustand skips notifying
  // when the state object is unchanged, while {} would re-render every
  // subscriber for nothing.
  finishScene: () => set((s) => {
    if (s.phase !== 'story') return s
    if (s.storyScene === 'ending') return { phase: 'complete', storyScene: null }
    return { phase: 'playing', storyScene: null }
  }),
  retryStage: () => set((s) => ({
    phase: 'playing', paused: false, talk: null, report: null, storyScene: null, runSerial: s.runSerial + 1,
    // After a game over a retry is a new round: full lives. A restart
    // mid-stage (pause menu) or after a clear puts back the stage's start.
    lives: s.phase === 'gameover' ? LIVES.start : s.livesAtStage,
  })),
  continueRun: () => set((s) => {
    if (s.phase !== 'stageclear' || s.mode !== 'story') return s
    if (s.stage < STORY_STAGES.length) {
      return { stage: s.stage + 1, phase: 'story', storyScene: introFor(s.stage + 1), report: null }
    }
    // Last stage: the ending — or, while later stages are still being
    // built, the end of what exists.
    if (STORY_STAGES.length >= STORY_LENGTH) return { phase: 'story', storyScene: 'ending', report: null }
    return { phase: 'complete', report: null }
  }),
  playTalk: (talk) => set({ talk }),
  finishTalk: () => set((s) => (s.talk ? { talk: null } : s)),
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
  autoPause: () => set((s) => (s.phase !== 'playing' || s.talk || s.paused ? s : { paused: true })),
}))

export const gameStore = useGameStore
