import { create } from 'zustand'
import { STORY_STAGES, STORY_LENGTH, type GameMode } from '../game/data/stages'
import { introFor, type SceneId, type Speaker } from '../game/data/story'
import { HULL } from '../game/data/chase'

/** HUD-facing mirror of the core, written by GameApp at a throttled rate. */
export interface CoreView {
  energy: number        // 0–100
  ready: boolean        // EMP can fire now
  empCharge: number     // 0 = just fired, 1 = minimum gap over
  catchSerial: number   // bumps on each absorbed round; drives the gauge pulse
}

const freshCore: CoreView = { energy: 0, ready: false, empCharge: 1, catchSerial: 0 }

/** What cost the ship a point of hull. Stages 2–3 add rocks and mines. */
export type HitCause = 'missile' | 'ram'

/**
 * One stage attempt's playtest metrics (design v0.2 §12): enough to see
 * whether players read "absorb energy, dodge solids", whether the EMP buys
 * distance, and whether standing still is enough to survive.
 */
export interface StageReport {
  stage: number
  mode: GameMode
  cleared: boolean
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

  setPhase: (p: GameState['phase']) => void
  setCore: (c: CoreView) => void
  setHull: (n: number) => void
  setClock: (timeLeft: number, duration: number) => void
  setHint: (h: Hint | null) => void
  setReport: (r: StageReport | null) => void
  startRun: (mode: GameMode) => void
  /** Play a story scene (combat waits until it finishes). */
  playScene: (scene: SceneId) => void
  /** The current scene ended or was skipped. */
  finishScene: () => void
  /** After a loss (or a cleared trial): the same stage again, no dialog. */
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
  timeLeft: 0,
  duration: 1,
  paused: false,
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

export const useGameStore = create<GameState>((set) => ({
  ...freshPlay,
  phase: 'title',
  mode: 'story' as GameMode,
  soundEnabled: loadSoundPref(),
  musicVolume: loadVolume(MUSIC_VOL_KEY),
  sfxVolume: loadVolume(SFX_VOL_KEY),

  setPhase: (phase) => set({ phase, paused: false }),
  setCore: (core) => set({ core }),
  setHull: (hull) => set((s) => (s.hull === hull ? s : { hull })),
  setClock: (timeLeft, duration) => set((s) =>
    (s.timeLeft === timeLeft && s.duration === duration ? s : { timeLeft, duration })),
  setHint: (hint) => set({ hint }),
  setReport: (report) => set({ report }),
  startRun: (mode) => set((s) => ({
    ...freshPlay,
    soundEnabled: s.soundEnabled,
    mode,
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
  retryStage: () => set({ phase: 'playing', paused: false, talk: null, report: null, storyScene: null }),
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
