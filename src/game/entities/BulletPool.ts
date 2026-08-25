import { Container, Sprite, Texture, Rectangle } from 'pixi.js'
import { PLAYFIELD_LEFT, PLAYFIELD_RIGHT } from '../config'

export interface Bullet {
  sprite: Sprite
  prevX: number
  prevY: number
  vx: number
  vy: number
  active: boolean
  grazed: boolean  // already awarded a graze; reset on acquire
  damage: number
  cancelsHostile: boolean
  penetrates: boolean
  hitEnemyIds: Set<EnemyHitTarget>
}

/** Object identity is enough to prevent one penetrating shot damaging the same enemy every frame. */
export type EnemyHitTarget = object

export class BulletPool {
  private pool: Bullet[] = []

  constructor(container: Container, private texture: Texture, size: number) {
    for (let i = 0; i < size; i++) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.visible = false
      container.addChild(sprite)
      this.pool.push({
        sprite, prevX: 0, prevY: 0, vx: 0, vy: 0,
        active: false, grazed: false, damage: 1, cancelsHostile: false,
        penetrates: false, hitEnemyIds: new Set(),
      })
    }
  }

  acquire(
    x: number, y: number, vx: number, vy: number,
    damage = 1, tint = 0xffffff, scale = 1, texture?: Texture,
    cancelsHostile = false, penetrates = false,
  ): Bullet | null {
    const b = this.pool.find((b) => !b.active)
    if (!b) return null
    b.active = true
    b.grazed = false
    b.vx = vx
    b.vy = vy
    b.damage = damage
    b.cancelsHostile = cancelsHostile
    b.penetrates = penetrates
    b.hitEnemyIds.clear()
    b.prevX = x
    b.prevY = y
    b.sprite.x = x
    b.sprite.y = y
    b.sprite.tint = tint
    b.sprite.scale.set(scale)
    b.sprite.texture = texture ?? this.texture
    b.sprite.visible = true
    return b
  }

  release(b: Bullet) {
    b.active = false
    b.sprite.visible = false
    b.hitEnemyIds.clear()
  }

  releaseAll() {
    for (const b of this.pool) {
      if (b.active) this.release(b)
    }
  }

  /** `_stageW` is unused: bullets are culled at the combat corridor's edge,
   *  not the stage's, so they never drift into the decorative side wings. */
  update(dt: number, _stageW: number, stageH: number) {
    for (const b of this.pool) {
      if (!b.active) continue
      b.prevX = b.sprite.x
      b.prevY = b.sprite.y
      b.sprite.x += b.vx * dt
      b.sprite.y += b.vy * dt
      if (
        b.sprite.y < -20 || b.sprite.y > stageH + 20 ||
        b.sprite.x < PLAYFIELD_LEFT - 40 || b.sprite.x > PLAYFIELD_RIGHT + 40
      ) this.release(b)
    }
  }

  get active(): Bullet[] {
    return this.pool.filter((b) => b.active)
  }
}
