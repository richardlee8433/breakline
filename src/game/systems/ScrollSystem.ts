import { Container, Graphics, Texture, TilingSprite } from 'pixi.js'
import { BgTheme } from '../data/stages'
import { SCROLL_SPEED } from '../data/chase'

// The scenery streams down-screen: the ship is flying forward (up).
const BG_SPEED = SCROLL_SPEED
const TILE_SPEED_MULT = 0.8   // distant nebula image scrolls slower…
const STAR_SPEED_MULT = 1.6   // …near star specks scroll faster → parallax

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface ThemeConfig {
  bgColor: number      // base fill, also the fallback if the image fails
  bgImage: string      // seamless 512x512 tile (Screaming Brain Studios, CC0)
  starPalette: number[]
}

const THEMES: Record<BgTheme, ThemeConfig> = {
  space: {
    bgColor: 0x000011,
    bgImage: './assets/bg/stage1-blue.png',
    starPalette: [0xffffff, 0xaaccff, 0xffffff, 0xccddff],
  },
  nebula: {
    bgColor: 0x0a0020,
    bgImage: './assets/bg/stage2-purple.png',
    starPalette: [0xff88ff, 0xcc66ff, 0x88aaff, 0xffaaff, 0xffffff],
  },
  asteroid: {
    bgColor: 0x020805,
    bgImage: './assets/bg/stage3-green.png',
    starPalette: [0x88ffaa, 0xaaffcc, 0xffffff, 0xccffdd, 0xffffff],
  },
}

/** Transparent layer of star specks — sits above the image for parallax. */
function buildStarLayer(
  stageW: number, stageH: number,
  palette: number[], seed: number,
): Graphics {
  const rng = mulberry32(seed)
  const g = new Graphics()
  for (let ci = 0; ci < palette.length; ci++) {
    const count = ci === 0 ? 70 : 15
    for (let i = 0; i < count; i++) {
      const x = rng() * stageW
      const y = rng() * stageH
      const s = rng() < 0.12 ? 2 : 1
      g.rect(x, y, s, s)
    }
    g.fill({ color: palette[ci], alpha: 0.5 + rng() * 0.5 })
  }
  return g
}

export class ScrollSystem {
  private stars: Graphics[] = []
  private tile: TilingSprite | null = null
  private base: Graphics | null = null
  private token = 0   // guards against a stale image landing after setTheme

  constructor(
    private container: Container,
    private stageW: number,
    private stageH: number,
    theme: BgTheme = 'space',
  ) {
    this.buildTheme(theme)
  }

  setTheme(theme: BgTheme) {
    for (const s of this.stars) this.container.removeChild(s)
    if (this.tile) this.container.removeChild(this.tile)
    if (this.base) this.container.removeChild(this.base)
    this.stars = []
    this.tile = null
    this.base = null
    this.buildTheme(theme)
  }

  private buildTheme(theme: BgTheme) {
    const cfg = THEMES[theme]
    const token = ++this.token

    this.base = new Graphics()
    this.base.rect(0, 0, this.stageW, this.stageH).fill({ color: cfg.bgColor })
    this.container.addChildAt(this.base, 0)

    const l0 = buildStarLayer(this.stageW, this.stageH, cfg.starPalette, 42)
    const l1 = buildStarLayer(this.stageW, this.stageH, cfg.starPalette, 99)
    l0.y = 0
    l1.y = -this.stageH
    this.container.addChild(l0, l1)
    this.stars = [l0, l1]

    // Load the nebula tile via HTMLImageElement (Pixi's worker loader gets
    // 403'd on VIVERSE); fall back silently to the solid base color.
    const img = new Image()
    img.onload = () => {
      if (token !== this.token) return   // theme changed while loading
      const sprite = new TilingSprite({
        texture: Texture.from(img),
        width: this.stageW,
        height: this.stageH,
      })
      sprite.tileScale.set(this.stageW / img.width)
      this.container.addChildAt(sprite, 1)   // above base, below stars
      this.tile = sprite
    }
    img.onerror = () => console.warn(`[ScrollSystem] bg image failed: ${cfg.bgImage}`)
    img.src = cfg.bgImage
  }

  update(dt: number) {
    if (this.tile) this.tile.tilePosition.y += BG_SPEED * TILE_SPEED_MULT * dt
    for (const s of this.stars) {
      s.y += BG_SPEED * STAR_SPEED_MULT * dt
      if (s.y >= this.stageH) s.y -= this.stageH * 2
    }
  }
}
