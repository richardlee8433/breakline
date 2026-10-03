import { Container, Graphics } from 'pixi.js'

const DURATION = 0.55

/**
 * Expanding ring blast (the EMP): a thick white leading edge with a cyan
 * trailing ring that stops at the pulse's reach, so the player sees exactly
 * what it covered. Lives in the bloom-filtered fx layer, so it glows.
 */
export class Shockwave {
  private g: Graphics
  private t = -1
  private x = 0
  private y = 0
  private maxR = 1

  constructor(container: Container) {
    this.g = new Graphics()
    container.addChild(this.g)
  }

  trigger(x: number, y: number, radius: number) {
    this.maxR = radius
    this.x = x
    this.y = y
    this.t = 0
  }

  update(dt: number) {
    if (this.t < 0) return
    this.t += dt
    const p = this.t / DURATION
    this.g.clear()
    if (p >= 1) {
      this.t = -1
      return
    }
    const ease = 1 - (1 - p) * (1 - p)   // fast start, slowing edge
    const r = ease * this.maxR
    const fade = 1 - p
    this.g.circle(this.x, this.y, r)
      .stroke({ color: 0xffffff, width: 4 + 16 * fade, alpha: fade })
    this.g.circle(this.x, this.y, r * 0.82)
      .stroke({ color: 0x66eeff, width: 3 + 10 * fade, alpha: fade * 0.7 })
    this.g.circle(this.x, this.y, r).fill({ color: 0x66ccff, alpha: 0.08 * fade })
  }
}
