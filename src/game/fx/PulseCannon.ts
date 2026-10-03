import { Container, Sprite, Texture } from 'pixi.js'
import { BulletPool } from '../entities/BulletPool'
import { Enemy } from '../entities/Enemy'
import { Boss } from '../entities/Boss'
import { KillFx, damageEnemy, damageBoss, shootDownMissile } from '../systems/CollisionSystem'
import { COUNTER } from '../data/core'
import { SPRITE_SCALE } from '../config'

const W = COUNTER.width * SPRITE_SCALE
const L = COUNTER.length * SPRITE_SCALE
const POOL = 4

interface Pulse { sprite: Sprite; active: boolean; hit: Set<object> }

/**
 * The first counter module: a piercing pulse up the screen. It damages each
 * enemy (and the boss) once on the way through, and erases hostile fire in
 * its path — energy rounds dissolve, missiles are knocked down.
 */
export class PulseCannon {
  private pool: Pulse[] = []

  constructor(container: Container, texture: Texture) {
    for (let i = 0; i < POOL; i++) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.visible = false
      container.addChild(sprite)
      this.pool.push({ sprite, active: false, hit: new Set() })
    }
  }

  fire(x: number, y: number) {
    const p = this.pool.find((p) => !p.active) ?? this.pool[0]
    p.active = true
    p.hit.clear()
    p.sprite.x = x
    p.sprite.y = y - L / 2
    p.sprite.alpha = 1
    p.sprite.visible = true
  }

  update(
    dt: number, enemies: Enemy[], boss: Boss | null,
    energyPools: BulletPool[], missiles: BulletPool, bossBullets: BulletPool, fx: KillFx,
  ) {
    for (const p of this.pool) {
      if (!p.active) continue
      p.sprite.y -= COUNTER.speed * dt
      p.sprite.scale.x = 0.9 + 0.1 * Math.sin(p.sprite.y * 0.08)
      if (p.sprite.y < -L) { this.release(p); continue }

      const left = p.sprite.x - W / 2, right = p.sprite.x + W / 2
      const top = p.sprite.y - L / 2, bottom = p.sprite.y + L / 2

      for (const e of enemies) {
        if (!e.active || p.hit.has(e)) continue
        const h = e.hitbox
        const ex = e.sprite.x + h.x, ey = e.sprite.y + h.y
        if (ex > right || ex + h.width < left || ey > bottom || ey + h.height < top) continue
        p.hit.add(e)
        fx.explosions.spawn(e.sprite.x, e.sprite.y, 1.2)
        damageEnemy(e, COUNTER.damage, fx)
      }

      if (boss?.active && !p.hit.has(boss)) {
        const b = boss.hitboxWorld
        if (!(b.x > right || b.x + b.width < left || b.y > bottom || b.y + b.height < top)) {
          p.hit.add(boss)
          damageBoss(boss, COUNTER.bossDamage, p.sprite.x, b.y + b.height, fx, bossBullets)
        }
      }

      for (const pool of energyPools) {
        for (const b of pool.all) {
          if (!b.active) continue
          const bx = b.sprite.x, by = b.sprite.y
          if (bx < left || bx > right || by < top || by > bottom) continue
          pool.release(b)
        }
      }
      for (const m of missiles.all) {
        if (!m.active) continue
        const mx = m.sprite.x, my = m.sprite.y
        if (mx < left || mx > right || my < top || my > bottom) continue
        shootDownMissile(missiles, m, fx)
      }
    }
  }

  releaseAll() {
    for (const p of this.pool) this.release(p)
  }

  private release(p: Pulse) {
    p.active = false
    p.sprite.visible = false
    p.hit.clear()
  }
}
