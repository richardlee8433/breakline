import { Container, Graphics } from 'pixi.js'
import { BulletPool } from '../entities/BulletPool'

export class BulletTrail {
  private g: Graphics

  constructor(container: Container) {
    this.g = new Graphics()
    container.addChildAt(this.g, 0)
  }

  update(playerBullets: BulletPool) {
    this.g.clear()
    for (const b of playerBullets.all) {
      if (b.active) this.drawTrail(b.sprite.x, b.sprite.y)
    }
  }

  private drawTrail(x: number, y: number) {
    // Soft wide glow
    this.g.moveTo(x, y).lineTo(x, y + 14)
      .stroke({ color: 0xffffcc, width: 6, alpha: 0.10 })
    // White hot core
    this.g.moveTo(x, y).lineTo(x, y + 6)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.92 })
    // Yellow mid
    this.g.moveTo(x, y + 5).lineTo(x, y + 13)
      .stroke({ color: 0xffee44, width: 2, alpha: 0.58 })
    // Orange tail
    this.g.moveTo(x, y + 12).lineTo(x, y + 22)
      .stroke({ color: 0xff8800, width: 1.5, alpha: 0.28 })
  }
}
