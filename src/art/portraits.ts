// Character bust portraits. As in Lastlight (src/art/portraitArt.ts), a
// character with hand-drawn art (public/assets/portraits/<id>.webp, busts cut
// from the v1 four-character lineup) uses it; anyone without falls back to procedural
// pixel art, 64×80, scaled with nearest-neighbour. The pixel engine and
// shared parts (Pix, body/head/eyes/…) are ported from Lastlight
// (lastlight-colony src/art/portraits.js).

const W = 64, H = 80

const hex = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]
const mix = (a: number, b: number, t: number) => {
  const A = hex(a), B = hex(b)
  return (Math.round(A[0] + (B[0] - A[0]) * t) << 16) | (Math.round(A[1] + (B[1] - A[1]) * t) << 8) | Math.round(A[2] + (B[2] - A[2]) * t)
}
/** Five-step ramp: [darkest, dark, base, light, lightest] */
const ramp = (c: number) => [mix(c, 0x120e1c, 0.55), mix(c, 0x120e1c, 0.28), c, mix(c, 0xfff4e0, 0.22), mix(c, 0xfff4e0, 0.45)]

type Fill = number | null | ((dx: number, dy: number, x: number, y: number) => number | null)
type PolyFill = number | ((x: number, y: number) => number)

class Pix {
  d = new Int32Array(W * H).fill(-1)
  set(x: number, y: number, c: number | null) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H && c != null) this.d[y * W + x] = c }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= W || y >= H ? -1 : this.d[y * W + x] }
  rect(x: number, y: number, w: number, h: number, c: number) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c) }
  /** Filled ellipse; f(dx, dy) gets -1..1 relative position, for shading. */
  ell(cx: number, cy: number, rx: number, ry: number, f: Fill) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) this.set(x, y, typeof f === 'function' ? f(dx, dy, x, y) : f)
    }
  }
  poly(pts: number[], f: PolyFill) {
    let y0 = Infinity, y1 = -Infinity
    for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]) }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs: number[] = []
      for (let i = 0; i < pts.length; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % pts.length], by = pts[(i + 3) % pts.length]
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) this.set(x, y, typeof f === 'function' ? f(x, y) : f)
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c)
  }
  /** Outline: any transparent pixel touching an opaque one takes the outline colour. */
  outline(c: number) {
    const add: [number, number][] = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.get(x, y) !== -1) continue
      if (this.get(x + 1, y) !== -1 || this.get(x - 1, y) !== -1 || this.get(x, y + 1) !== -1 || this.get(x, y - 1) !== -1) add.push([x, y])
    }
    for (const [x, y] of add) this.set(x, y, c)
  }
}

// ── shared parts (Lastlight) ────────────────────────────────────────────────
/** Sphere shading lit from the top left. */
const lit = (R: number[], bias = 0) => (dx: number, dy: number) => {
  const l = -0.55 * dx - 0.65 * dy + bias
  return R[l > 0.85 ? 4 : l > 0.35 ? 3 : l > -0.75 ? 2 : l > -1.05 ? 1 : 0]
}
function body(p: Pix, suit: number, opts: { broad?: number; seam?: boolean } = {}) {
  const S = ramp(suit), cx = 32
  for (let y = 55; y < H; y++) {
    const hw = Math.min(30, 12 + (y - 55) * 1.7 + (opts.broad ?? 0))
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const t = (x - cx) / hw
      p.set(x, y, S[t < -0.55 ? 3 : t > 0.55 ? 1 : 2])
    }
  }
  if (opts.seam !== false) for (let y = 62; y < H; y++) p.set(cx, y, S[1])
}
function neck(p: Pix, skin: number) {
  const K = ramp(skin)
  p.rect(28, 47, 9, 9, K[2]); p.rect(34, 47, 3, 9, K[1])
  p.rect(28, 47, 9, 1, K[1])
}
function head(p: Pix, skin: number, opts: { rx?: number; ry?: number } = {}) {
  const K = ramp(skin), rx = (opts.rx ?? 11) + 0.8, ry = (opts.ry ?? 13) + 0.6
  p.ell(32, 35, rx, ry, lit(K))
  // narrow the chin
  for (const x of [32 - rx, 32 + rx]) for (let y = 43; y < 49; y++) if (p.get(x, y) !== -1) p.set(x, y, -1)
  p.set(21, 36, K[2]); p.set(43, 36, K[1])
  p.set(20, 37, K[1]); p.set(44, 37, K[0])
}
function eyes(p: Pix, iris: number, opts: { y?: number; gap?: number; closed?: boolean; glint?: boolean } = {}) {
  const y = opts.y ?? 37, gap = opts.gap ?? 5
  for (const [x, side] of [[32 - gap, -1], [32 + gap - 1, 1]]) {
    if (opts.closed) { p.rect(x - 1, y + 1, 3, 1, 0x2a1a22); continue }
    p.rect(x - 1, y, 3, 2, 0xf4f0ea)
    p.set(x + (side < 0 ? 1 : 0), y, iris); p.set(x + (side < 0 ? 1 : 0), y + 1, mix(iris, 0x000000, 0.4))
    p.rect(x - 1, y - 1, 3, 1, 0x2a1a22)
    if (opts.glint !== false) p.set(x + (side < 0 ? 1 : 0), y, mix(iris, 0xffffff, 0.5))
  }
}
function brows(p: Pix, color: number, mood: 'flat' | 'angry' | 'up' | 'raise' = 'flat') {
  const y = 33
  const L = mood === 'angry' ? [[24, y], [25, y], [26, y + 1], [27, y + 1]] : mood === 'up' ? [[24, y + 1], [25, y], [26, y], [27, y]] : [[24, y], [25, y], [26, y], [27, y]]
  const R = mood === 'angry' ? [[37, y + 1], [38, y + 1], [39, y], [40, y]] : mood === 'up' ? [[37, y], [38, y], [39, y], [40, y + 1]] : mood === 'raise' ? [[37, y - 2], [38, y - 2], [39, y - 1], [40, y]] : [[37, y], [38, y], [39, y], [40, y]]
  for (const [x, yy] of [...L, ...R]) p.set(x, yy, color)
}
function nose(p: Pix, skin: number) { const K = ramp(skin); p.set(33, 40, K[1]); p.set(33, 41, K[1]); p.set(32, 42, K[0]) }
function mouth(p: Pix, kind: 'smile' | 'grin' | 'smirk' | 'open' | 'flat', skin: number) {
  const K = ramp(skin), dark = 0x5a2230
  if (kind === 'smile') { p.set(29, 45, dark); p.rect(30, 46, 5, 1, dark); p.set(35, 45, dark) }
  else if (kind === 'grin') { p.rect(29, 45, 7, 1, dark); p.rect(30, 46, 5, 1, 0xf4f0ea); p.rect(30, 47, 5, 1, dark) }
  else if (kind === 'smirk') { p.rect(30, 46, 4, 1, dark); p.set(34, 45, dark) }
  else if (kind === 'open') { p.rect(30, 45, 4, 3, dark); p.rect(31, 46, 2, 1, 0xd05060) }
  else { p.rect(30, 46, 5, 1, dark) }
  p.set(32, 48, K[1])
}
function background(ctx: CanvasRenderingContext2D, c1: number, c2: number, seed: number) {
  for (let y = 0; y < H; y++) {
    ctx.fillStyle = '#' + mix(c1, c2, y / H).toString(16).padStart(6, '0')
    ctx.fillRect(0, y, W, 1)
  }
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = i % 5 ? 'rgba(255,255,255,0.35)' : 'rgba(255,230,160,0.7)'
    ctx.fillRect(Math.floor(r() * W), Math.floor(r() * 50), 1, 1)
  }
}

// ── Breakline cast (names and looks are provisional, game plan §3) ──────────
const SKIN = { a: 0xf2c7a0, b: 0xd9a276, c: 0xa86f4c, d: 0x7a4a32, e: 0xe8b894 }
// Faction palettes from the game plan §10: the resistance flies worn ships
// with warm cockpits; Helion is standardized white-grey with industrial
// yellow; the ancient tech glows violet-blue.
const HELION_YELLOW = 0xf2c230
const ANCIENT_GLOW = 0x9a7cff

export const PORTRAITS = {
  /** Kai Mercer: local freight pilot, not an ace. Messy dark hair, worn brown flight
   *  jacket with a hand-sewn patch, red scarf, headset mic. */
  kai(p: Pix) {
    const skin = SKIN.b, hair = ramp(0x2a2224)
    body(p, 0x7a5432)
    const J = ramp(0x7a5432)
    p.poly([22, 55, 42, 55, 38, 61, 26, 61], (x) => (x < 32 ? 0xc8402e : 0xa0301e))   // scarf
    p.rect(30, 60, 5, 8, 0xb8382a)
    p.rect(12, 64, 3, 16, J[1]); p.rect(49, 64, 3, 16, J[1])                           // jacket seams
    p.rect(41, 66, 6, 5, 0x3a6a8a); p.set(43, 68, 0xf0d070); p.set(44, 67, 0xf0d070)  // star patch
    neck(p, skin); head(p, skin)
    p.ell(32, 26, 13, 7, (_dx, dy) => hair[dy < -0.4 ? 3 : 2])
    for (const [x, y] of [[21, 24], [26, 20], [33, 19], [39, 21], [44, 26]]) p.rect(x, y, 2, 3, hair[2])
    p.rect(20, 27, 3, 9, hair[2]); p.rect(42, 27, 3, 8, hair[1])
    p.poly([22, 26, 33, 24, 28, 32, 23, 31], hair[2])                                  // fringe swept left
    eyes(p, 0x4a3424); brows(p, hair[0], 'raise'); nose(p, skin); mouth(p, 'smirk', skin)
    p.rect(19, 33, 3, 7, 0x3a3a48); p.rect(19, 34, 1, 5, 0x6a6a7c)                     // headset
    p.line(21, 40, 26, 44, 0x3a3a48); p.set(26, 44, 0x6fe0ff)
  },
  /** Rosa Vega: the engineer who wired the alien core into an old fighter. Short
   *  bob, welding goggles pushed up (lenses lit cyan by the core), teal
   *  coveralls, a stylus behind the ear, a grease smudge. */
  rosa(p: Pix) {
    const skin = SKIN.c, hair = ramp(0x3a2436)
    body(p, 0x2f6f6a)
    const C = ramp(0x2f6f6a)
    p.rect(26, 55, 13, 3, C[3])                                                         // collar
    p.rect(16, 66, 8, 7, C[1]); p.rect(17, 67, 6, 1, C[3])                              // chest pocket
    p.line(18, 66, 18, 61, 0xe0e4ea); p.set(18, 60, 0xff6a3a)                           // pen in pocket
    p.rect(40, 70, 9, 2, 0xe8b830)                                                      // tool loop
    // the bob sits behind the head, so draw it first and let the face cover it
    p.ell(32, 31, 14, 13, (dx, dy) => hair[dy < -0.5 ? 3 : dx > 0.5 ? 1 : 2])
    neck(p, skin); head(p, skin, { rx: 10.5 })
    p.poly([22, 30, 36, 28, 34, 33, 23, 33], hair[2])                                   // bangs
    // goggles on the forehead, lenses glowing with core light
    p.rect(20, 25, 25, 3, 0x2a2a34)
    p.ell(27, 26, 3.2, 2.4, 0x5ff0ff); p.ell(37, 26, 3.2, 2.4, 0x5ff0ff)
    p.set(26, 25, 0xe8ffff); p.set(36, 25, 0xe8ffff)
    p.line(44, 31, 47, 27, 0xe8e2d0); p.set(47, 27, 0x3a3a48)                           // stylus behind ear
    eyes(p, 0x5a3a24); brows(p, hair[0], 'up'); nose(p, skin); mouth(p, 'grin', skin)
    p.set(38, 42, 0x4a3a34); p.set(39, 43, 0x4a3a34)                                    // grease smudge
  },
  /** Dr. Mira Sen: researcher on the evacuation ship. Silver crop, a data
   *  visor, dark coat with violet ancient-tech glyph lines. */
  mira(p: Pix) {
    const skin = SKIN.d, hair = ramp(0xc8ccd8)
    body(p, 0x2a2a48, { seam: false })
    const G = ANCIENT_GLOW
    p.poly([28, 55, 36, 55, 35, 80, 29, 80], 0x1a1a30)                                  // inner layer
    p.line(24, 58, 18, 80, G); p.line(40, 58, 46, 80, G)                                // glyph piping
    p.rect(14, 68, 3, 3, G); p.rect(47, 68, 3, 3, G); p.set(15, 69, 0xe8e0ff); p.set(48, 69, 0xe8e0ff)
    // data slate held up, screen lit
    p.poly([44, 62, 56, 60, 58, 78, 46, 80], (_x, y) => (y < 63 ? 0x5a5a70 : 0x1a1830))
    p.rect(48, 65, 7, 1, G); p.rect(48, 68, 5, 1, G); p.rect(48, 71, 8, 1, 0x6fe0ff)
    neck(p, skin); head(p, skin, { ry: 13.5 })
    p.ell(32, 26, 12.5, 7, (_dx, dy) => hair[dy < -0.3 ? 4 : 2])                       // silver crop
    p.rect(20, 27, 3, 9, hair[2]); p.rect(42, 27, 3, 6, hair[1])
    p.poly([21, 27, 30, 24, 27, 30, 21, 31], hair[3])
    eyes(p, 0x3a2a1a); brows(p, hair[1], 'up'); nose(p, skin); mouth(p, 'open', skin)
    p.rect(34, 35, 9, 4, 0x2a2a48); p.rect(35, 36, 7, 2, G); p.set(36, 36, 0xf0e8ff)  // visor over the eye
  },
  /** Commander Voss: Helion's local blockade-fleet chief. Standard-issue
   *  white-grey uniform with industrial-yellow trim, peaked cap, grey
   *  temples, a hard stare. */
  voss(p: Pix) {
    const skin = SKIN.e, hair = ramp(0x5a5458)
    body(p, 0xc8ccd4, { broad: 2 })
    const U = ramp(0xc8ccd4)
    p.rect(21, 55, 23, 5, U[3]); p.rect(21, 59, 23, 1, HELION_YELLOW)                  // high collar
    for (let x = 13; x < 22; x++) p.set(x, 61, HELION_YELLOW)                           // shoulder boards
    for (let x = 43; x < 52; x++) p.set(x, 61, HELION_YELLOW)
    for (let x = 12; x < 22; x += 2) p.set(x, 62, 0x2a2a30)                             // hazard stripes
    for (let x = 43; x < 53; x += 2) p.set(x, 62, 0x2a2a30)
    p.poly([38, 66, 46, 66, 42, 72], HELION_YELLOW); p.set(42, 68, 0xfff4b0)            // Helion mark
    p.rect(16, 68, 7, 1, 0x7a8090); p.rect(16, 70, 7, 1, 0x7a8090)                      // ribbons
    neck(p, skin); head(p, skin, { rx: 11, ry: 13.5 })
    p.rect(20, 29, 2, 8, 0xb0aca8); p.rect(43, 29, 2, 8, 0xa09c98)                      // grey temples
    // peaked cap
    p.ell(32, 24, 14, 6, (_dx, dy) => (dy < -0.2 ? 0xe4e8ee : 0xc8ccd4))
    p.rect(18, 26, 29, 3, 0xd8dce4); p.rect(18, 27, 29, 1, HELION_YELLOW)
    p.poly([19, 29, 45, 29, 42, 32, 22, 32], 0x2a2a34)                                  // visor brim
    p.set(32, 22, HELION_YELLOW); p.set(31, 23, HELION_YELLOW); p.set(33, 23, HELION_YELLOW)
    eyes(p, 0x5a6a7a, { gap: 5 }); brows(p, hair[0], 'angry'); nose(p, skin); mouth(p, 'flat', skin)
    p.rect(27, 47, 11, 1, ramp(skin)[1])                                                // square jaw
    p.line(38, 39, 39, 43, mix(skin, 0x6a2a2a, 0.35))                                   // old scar
  },
} as const

export type PortraitId = keyof typeof PORTRAITS

const PORTRAIT_BG: Record<PortraitId, [number, number]> = {
  kai: [0x3a2a2a, 0x1a1418], rosa: [0x1e3a3a, 0x0e1a1c],
  mira: [0x2e2450, 0x120e24], voss: [0x383c48, 0x14161e],
}

/** Render one portrait to a 64×80 canvas. bg=false leaves the background clear. */
export function renderPortrait(id: PortraitId, bg = true): HTMLCanvasElement {
  const p = new Pix()
  PORTRAITS[id](p)
  p.outline(0x140e1c)
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  if (bg) { const [a, b] = PORTRAIT_BG[id]; background(ctx, a, b, id.length * 977 + 13) }
  const img = ctx.getImageData(0, 0, W, H)
  for (let i = 0; i < W * H; i++) {
    const c = p.d[i]
    if (c === -1) continue
    img.data[i * 4] = (c >> 16) & 255; img.data[i * 4 + 1] = (c >> 8) & 255; img.data[i * 4 + 2] = c & 255; img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return cv
}

/** Characters with hand-drawn busts in public/assets/portraits/. */
const HAND_DRAWN: ReadonlySet<PortraitId> = new Set<PortraitId>(['kai', 'rosa', 'mira', 'voss'])

const cache = new Map<string, string>()
/** Portrait image for a character, and whether it is the pixel stand-in. */
export function portraitURL(id: PortraitId): { url: string; pixel: boolean } {
  if (HAND_DRAWN.has(id)) return { url: `./assets/portraits/${id}.webp`, pixel: false }
  if (!cache.has(id)) cache.set(id, renderPortrait(id, false).toDataURL())
  return { url: cache.get(id)!, pixel: true }
}
