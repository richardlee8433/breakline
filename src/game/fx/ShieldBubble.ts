import { Container, Graphics } from 'pixi.js'
import { SPRITE_SCALE } from '../config'

const R = 40 * SPRITE_SCALE
const BREAK_TIME = 0.35

/**
 * The core's shield, drawn around the ship: a faint cyan bubble while any
 * layer is up, with one pip per layer so "how many hits can I take" reads at
 * a glance. A blocked hit plays an outward burst.
 */
export class ShieldBubble {
  private g = new Graphics()
  private age = 0
  private breakT = 0
  private breakX = 0
  private breakY = 0

  constructor(container: Container) {
    container.addChild(this.g)
  }

  /** Play the burst at the ship's position. */
  burst(x: number, y: number) {
    this.breakT = BREAK_TIME
    this.breakX = x; this.breakY = y
  }

  update(dt: number, x: number, y: number, layers: number, visible: boolean) {
    this.age += dt
    this.g.clear()

    if (visible && layers > 0) {
      const pulse = 0.85 + 0.15 * Math.sin(this.age * 4)
      this.g.circle(x, y, R).fill({ color: 0x33eeff, alpha: 0.05 * pulse })
      this.g.circle(x, y, R).stroke({ color: 0x7ff6ff, width: 1.5 + layers * 0.5, alpha: 0.35 * pulse })
      // one pip per layer, spread along the bubble's lower arc
      for (let i = 0; i < layers; i++) {
        const a = Math.PI / 2 + (i - (layers - 1) / 2) * 0.32
        this.g.circle(x + Math.cos(a) * R, y + Math.sin(a) * R, 2.6 * SPRITE_SCALE).fill({ color: 0xe8ffff, alpha: 0.9 })
      }
    }

    if (this.breakT > 0) {
      this.breakT -= dt
      const p = 1 - Math.max(0, this.breakT) / BREAK_TIME
      this.g.circle(this.breakX, this.breakY, R * (1 + p * 0.9))
        .stroke({ color: 0xffffff, width: 4 * (1 - p) + 1, alpha: 1 - p })
      this.g.circle(this.breakX, this.breakY, R * (1 + p * 0.5))
        .stroke({ color: 0x33eeff, width: 3, alpha: 0.7 * (1 - p) })
    }
  }

  clear() {
    this.breakT = 0
    this.g.clear()
  }
}
