import { Container, Graphics, Sprite, Texture } from 'pixi.js'

const CATCH_POOL = 24
const CATCH_TIME = 0.16
const GLOW_TIME = 0.25

interface Catch { sprite: Sprite; t: number; fromX: number; fromY: number }

/**
 * The always-on recovery field: a faint ring around the ship (so the player
 * always sees its reach), a flare on each absorbed round, and the catch
 * animation that pulls the round into the hull.
 */
export class AbsorbField {
  private g = new Graphics()
  private age = 0
  private glow = 0
  private catches: Catch[] = []
  /** Radius in stage pixels, set from the ship's size. */
  radius = 40

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

  /** Shared with collision, so what you see is what absorbs. */
  contains(shipX: number, shipY: number, bx: number, by: number): boolean {
    const dx = bx - shipX, dy = by - shipY
    return dx * dx + dy * dy <= this.radius * this.radius
  }

  spawnCatch(x: number, y: number) {
    const c = this.catches.find((c) => c.t <= 0) ?? this.catches[0]
    c.t = CATCH_TIME; c.fromX = x; c.fromY = y
    c.sprite.visible = true
    this.glow = GLOW_TIME
  }

  update(dt: number, shipX: number, shipY: number, visible: boolean) {
    this.age += dt
    if (this.glow > 0) this.glow -= dt
    this.g.clear()
    if (visible) {
      const flare = Math.max(0, this.glow / GLOW_TIME)
      const pulse = 0.8 + 0.2 * Math.sin(this.age * 4)
      this.g.circle(shipX, shipY, this.radius)
        .fill({ color: 0x33eeff, alpha: 0.05 + 0.12 * flare })
      this.g.circle(shipX, shipY, this.radius)
        .stroke({ color: 0x9ff8ff, width: 1.5 + 1.5 * flare, alpha: 0.28 * pulse + 0.5 * flare })
    }

    for (const c of this.catches) {
      if (c.t <= 0) continue
      c.t -= dt
      const p = 1 - Math.max(0, c.t) / CATCH_TIME   // 0 → 1
      const e = p * p                                // accelerate into the ship
      c.sprite.x = c.fromX + (shipX - c.fromX) * e
      c.sprite.y = c.fromY + (shipY - c.fromY) * e
      c.sprite.scale.set(1.3 - p)
      c.sprite.alpha = 1 - p * 0.6
      if (c.t <= 0) c.sprite.visible = false
    }
  }

  clear() {
    this.glow = 0
    this.g.clear()
    for (const c of this.catches) { c.t = 0; c.sprite.visible = false }
  }
}
