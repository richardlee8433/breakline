import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { ABSORB } from '../data/core'
import { SPRITE_SCALE } from '../config'

const RADIUS = ABSORB.radius * SPRITE_SCALE
const APEX = ABSORB.apexOffset * SPRITE_SCALE
const HALF = (ABSORB.halfAngleDeg * Math.PI) / 180
const FADE = 0.12
const ARC_STEPS = 14
const CATCH_POOL = 24
const CATCH_TIME = 0.16

interface Catch { sprite: Sprite; t: number; fromX: number; fromY: number }

/**
 * Draws the absorb window — the catch wedge in front of the nose, so the
 * player sees exactly what is covered — and the catch animation: each
 * captured round is pulled into the ship and shrinks as it lands.
 */
export class AbsorbField {
  private g = new Graphics()
  private alpha = 0
  private age = 0
  private catches: Catch[] = []

  constructor(container: Container, roundTexture: Texture) {
    container.addChild(this.g)
    for (let i = 0; i < CATCH_POOL; i++) {
      const sprite = new Sprite(roundTexture)
      sprite.anchor.set(0.5)
      sprite.visible = false
      container.addChild(sprite)
      this.catches.push({ sprite, t: 0, fromX: 0, fromY: 0 })
    }
  }

  /** Pure geometry, shared with collision so what you see is what catches. */
  static contains(shipX: number, shipY: number, bx: number, by: number): boolean {
    const dx = bx - shipX
    const dy = by - (shipY + APEX)
    if (dy >= 0 || dx * dx + dy * dy > RADIUS * RADIUS) return false
    return Math.atan2(Math.abs(dx), -dy) <= HALF
  }

  spawnCatch(x: number, y: number) {
    const c = this.catches.find((c) => c.t <= 0) ?? this.catches[0]
    c.t = CATCH_TIME; c.fromX = x; c.fromY = y
    c.sprite.visible = true
  }

  update(dt: number, shipX: number, shipY: number, open: boolean) {
    this.age += dt
    this.alpha = open ? 1 : Math.max(0, this.alpha - dt / FADE)
    this.g.clear()
    if (this.alpha > 0) this.drawWedge(shipX, shipY)

    for (const c of this.catches) {
      if (c.t <= 0) continue
      c.t -= dt
      const p = 1 - Math.max(0, c.t) / CATCH_TIME   // 0 → 1
      const e = p * p                                // accelerate into the ship
      c.sprite.x = c.fromX + (shipX - c.fromX) * e
      c.sprite.y = c.fromY + (shipY - 10 * SPRITE_SCALE - c.fromY) * e
      c.sprite.scale.set(1.3 - p)
      c.sprite.alpha = 1 - p * 0.6
      if (c.t <= 0) c.sprite.visible = false
    }
  }

  clear() {
    this.alpha = 0
    this.g.clear()
    for (const c of this.catches) { c.t = 0; c.sprite.visible = false }
  }

  private drawWedge(x: number, y: number) {
    const ay = y + APEX
    const pulse = 0.75 + 0.25 * Math.sin(this.age * 30)
    const pts: number[] = [x, ay]
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = -Math.PI / 2 - HALF + (2 * HALF * i) / ARC_STEPS
      pts.push(x + Math.cos(a) * RADIUS, ay + Math.sin(a) * RADIUS)
    }
    const k = this.alpha
    this.g.poly(pts).fill({ color: 0x33eeff, alpha: 0.13 * k * pulse })
    this.g.poly(pts).stroke({ color: 0x9ff8ff, width: 2, alpha: 0.75 * k })
    // A brighter leading arc: the catching edge.
    const a0 = -Math.PI / 2 - HALF
    this.g.moveTo(x + Math.cos(a0) * RADIUS, ay + Math.sin(a0) * RADIUS)
      .arc(x, ay, RADIUS, a0, -Math.PI / 2 + HALF)
      .stroke({ color: 0xffffff, width: 3, alpha: 0.6 * k * pulse })
  }
}
