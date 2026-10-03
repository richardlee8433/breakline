import { Container, Sprite, Texture } from 'pixi.js'
import { PLAYFIELD_LEFT, PLAYFIELD_RIGHT } from '../config'

export interface Bullet {
  sprite: Sprite
  vx: number
  vy: number
  active: boolean
  grazed: boolean  // already awarded a graze; reset on acquire
  damage: number
  /** Guided missiles: max turn rate (rad/s), 0 = flies straight. */
  turn: number
  /** Guided missiles: seconds left before it burns out. */
  life: number
}

export class BulletPool {
  /** Every slot, active or not. Hot loops iterate this and skip inactive
   *  slots rather than building a filtered array each frame. */
  readonly all: Bullet[] = []

  /** `orient`: rotate each sprite to its velocity (missiles); otherwise
   *  sprites stay upright (round energy rounds, player shots). */
  constructor(container: Container, private texture: Texture, size: number, private orient = false) {
    for (let i = 0; i < size; i++) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.visible = false
      container.addChild(sprite)
      this.all.push({ sprite, vx: 0, vy: 0, active: false, grazed: false, damage: 1, turn: 0, life: 0 })
    }
  }

  acquire(
    x: number, y: number, vx: number, vy: number,
    damage = 1, tint = 0xffffff, scale = 1, texture?: Texture,
  ): Bullet | null {
    const b = this.all.find((b) => !b.active)
    if (!b) return null
    b.active = true
    b.grazed = false
    b.turn = 0
    b.life = 0
    b.vx = vx
    b.vy = vy
    b.damage = damage
    b.sprite.x = x
    b.sprite.y = y
    b.sprite.tint = tint
    b.sprite.scale.set(scale)
    b.sprite.texture = texture ?? this.texture
    b.sprite.rotation = this.orient ? Math.atan2(vy, vx) + Math.PI / 2 : 0
    b.sprite.visible = true
    return b
  }

  release(b: Bullet) {
    b.active = false
    b.sprite.visible = false
  }

  releaseAll() {
    for (const b of this.all) {
      if (b.active) this.release(b)
    }
  }

  /** `_stageW` is unused: bullets are culled at the combat corridor's edge,
   *  not the stage's, so they never drift into the decorative side wings. */
  update(dt: number, _stageW: number, stageH: number) {
    for (const b of this.all) {
      if (!b.active) continue
      b.sprite.x += b.vx * dt
      b.sprite.y += b.vy * dt
      if (
        b.sprite.y < -20 || b.sprite.y > stageH + 20 ||
        b.sprite.x < PLAYFIELD_LEFT - 40 || b.sprite.x > PLAYFIELD_RIGHT + 40
      ) this.release(b)
    }
  }
}
