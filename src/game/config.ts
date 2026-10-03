// Stage dimensions, computed once at load from the container's aspect ratio.
//
// Portrait (phones): the classic arcade column — fixed 480 width, height
// stretched to the device (so the game fills the screen edge to edge).
// Landscape (desktop / VIVERSE iframe): a wide battlefield — fixed 900
// height, width stretched to the container. App.tsx scales the stage to
// the viewport; since the stage matches the viewport aspect, both axes fill.

const BASE_W = 480

function computeStage(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: BASE_W, h: 640 }
  const vw = window.innerWidth
  const vh = window.innerHeight
  // innerWidth can be 0 while the window is still laying out (embeds,
  // headless tabs) — guard, or NaN poisons every size downstream.
  if (!vw || !vh || !Number.isFinite(vh / vw)) return { w: BASE_W, h: 640 }

  if (vh >= vw) {
    const h = Math.round(Math.min(1040, Math.max(640, BASE_W * (vh / vw))))
    return { w: BASE_W, h }
  }
  const h = 900
  const w = Math.round(Math.min(1600, Math.max(BASE_W, h * (vw / vh))))
  return { w, h }
}

const stage = computeStage()
export const STAGE_W = stage.w
export const STAGE_H = stage.h

// How many classic 480-wide columns the field spans. Horizontal formations
// multiply their counts by this so a wide field keeps the same enemies per
// screen-width — otherwise the same wave spread over 3x the width feels empty.
export const PLAYFIELD_W = Math.min(720, STAGE_W)
export const PLAYFIELD_LEFT = (STAGE_W - PLAYFIELD_W) / 2
export const PLAYFIELD_RIGHT = PLAYFIELD_LEFT + PLAYFIELD_W
export const FORMATION_SCALE = Math.min(1.5, PLAYFIELD_W / BASE_W)

// Ships/bullets scale up on the wide landscape field so they stay readable on
// a big monitor. Deliberately NOT the full FIELD_RATIO: desktop height (900)
// is close to portrait height, so proportional scaling would crowd the
// vertical axis. Everything danmaku-related (hitboxes, bullet size, graze)
// scales by this same factor, keeping those relationships intact.
export const SPRITE_SCALE = PLAYFIELD_W / BASE_W

// Development only: `?time=0.25` runs every stage (its length and its wave
// timeline) at a quarter of the real length, for testing the stage flow.
// Players never see it; the default is the full length.
function readTimeScale(): number {
  if (typeof window === 'undefined') return 1
  const v = parseFloat(new URLSearchParams(window.location.search).get('time') ?? '')
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 1
}
export const TIME_SCALE = readTimeScale()
