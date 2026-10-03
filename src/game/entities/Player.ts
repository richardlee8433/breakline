import { Container, Sprite, Texture } from 'pixi.js'
import { Actions } from '../systems/InputSystem'
import { PLAYFIELD_LEFT, PLAYFIELD_RIGHT, PLAYFIELD_W, SPRITE_SCALE } from '../config'
import { PLAYER, HULL } from '../data/chase'
import type { HitCause } from '../../store/gameStore'

const SPEED = PLAYER.speed * SPRITE_SCALE
const CENTER_X = PLAYFIELD_LEFT + PLAYFIELD_W / 2

/**
 * The escort ship. No gun and no dash in the chase prototype: it moves,
 * and its hull takes HULL.max hits per stage. It flies in the upper-middle
 * band of the field (PLAYER.bandTop–bandBottom).
 */
export class Player {
  sprite: Sprite
  /** Half-size of the damage-taking core. */
  readonly hitHalf = (PLAYER.hitboxSize * SPRITE_SCALE) / 2
  hull = HULL.max
  private invincible = 0
  private flashTimer = 0
  private dead = false
  private tilt = 0
  /** Distance moved last frame, for the "stood still" playtest metric. */
  moved = 0
  /** Set by hit(); GameApp reads and clears it. */
  lastHit: HitCause | null = null

  constructor(container: Container, texture: Texture, private stageH: number) {
    this.sprite = new Sprite(texture)
    this.sprite.anchor.set(0.5)
    this.sprite.scale.set(PLAYER.displayH * SPRITE_SCALE / texture.height)
    container.addChild(this.sprite)
    this.reset()
  }

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }
  get isDead() { return this.dead }
  get isInvincible() { return this.invincible > 0 }
  /** Visible width, unrotated: sizes the recovery field. */
  get shipWidth() { return Math.abs(this.sprite.scale.x) * this.sprite.texture.width }

  /** A solid hazard connects. Returns true if it cost hull (false while
   *  invincible or already dead, so the hazard passes through). */
  hit(cause: HitCause): boolean {
    if (this.dead || this.invincible > 0) return false
    this.hull = Math.max(0, this.hull - 1)
    this.lastHit = cause
    if (this.hull === 0) {
      this.dead = true
      this.sprite.visible = false
    } else {
      this.invincible = HULL.iframes
      this.flashTimer = 0
    }
    return true
  }

  reset() {
    this.hull = HULL.max
    this.dead = false
    this.invincible = 0
    this.tilt = 0
    this.lastHit = null
    this.sprite.rotation = 0
    this.sprite.visible = true
    this.sprite.alpha = 1
    this.sprite.tint = 0xffffff
    this.sprite.x = CENTER_X
    this.sprite.y = this.stageH * PLAYER.startY
  }

  update(dt: number, actions: Actions) {
    if (this.dead) { this.moved = 0; return }
    const x0 = this.sprite.x, y0 = this.sprite.y
    const { moveX, moveY } = actions
    const len = Math.sqrt(moveX * moveX + moveY * moveY) || 1
    this.sprite.x += (moveX / len) * SPEED * dt
    this.sprite.y += (moveY / len) * SPEED * dt
    // Touch is a relative drag: the ship follows the finger's motion, not
    // its position, so the thumb can rest anywhere.
    if (actions.touchActive) { this.sprite.x += actions.touchDX; this.sprite.y += actions.touchDY }
    const hw = this.sprite.width / 2
    this.sprite.x = Math.max(PLAYFIELD_LEFT + hw, Math.min(PLAYFIELD_RIGHT - hw, this.sprite.x))
    this.sprite.y = Math.max(this.stageH * PLAYER.bandTop, Math.min(this.stageH * PLAYER.bandBottom, this.sprite.y))
    const dx = this.sprite.x - x0, dy = this.sprite.y - y0
    this.moved = Math.sqrt(dx * dx + dy * dy)

    const tiltInput = Math.max(-1, Math.min(1, moveX + (actions.touchActive ? actions.touchDX * 0.12 : 0)))
    this.tilt += (tiltInput * PLAYER.bankAngle - this.tilt) * Math.min(1, 12 * dt)
    this.sprite.rotation = this.tilt

    if (this.invincible > 0) {
      this.invincible -= dt
      this.flashTimer += dt
      this.sprite.alpha = this.invincible > 0 && Math.sin(this.flashTimer * 20) <= 0 ? 0.3 : 1
    }
  }
}
