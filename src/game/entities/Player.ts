import { Container, Sprite, Texture, Rectangle } from 'pixi.js'
import { Actions } from '../systems/InputSystem'
import { BulletPool } from './BulletPool'
import { audioSystem } from '../systems/AudioSystem'
import { PLAYFIELD_LEFT, PLAYFIELD_RIGHT, PLAYFIELD_W, SPRITE_SCALE } from '../config'
import { PLAYER } from '../data/player'

const SPEED = PLAYER.speed * SPRITE_SCALE
const PLAYFIELD_CENTER = PLAYFIELD_LEFT + PLAYFIELD_W / 2
const HITBOX_SIZE = PLAYER.hitboxSize * SPRITE_SCALE

export class Player {
  sprite: Sprite
  /** Relative to the ship's center. */
  hitbox: Rectangle
  active = true
  private fireTimer = 0
  private invincible = 0
  private flashTimer = 0
  private state: 'alive' | 'dead' | 'respawning' = 'alive'
  private respawnTimer = 0
  private justDied = false
  private tilt = 0

  constructor(container: Container, texture: Texture, private bulletPool: BulletPool, private stageH: number) {
    this.sprite = new Sprite(texture)
    this.sprite.anchor.set(0.5)
    this.sprite.x = PLAYFIELD_CENTER
    this.sprite.y = stageH * 0.8
    this.sprite.scale.set(PLAYER.displayH * SPRITE_SCALE / texture.height)
    container.addChild(this.sprite)
    const half = HITBOX_SIZE / 2
    this.hitbox = new Rectangle(-half, -half, HITBOX_SIZE, HITBOX_SIZE)
  }

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }
  get isDead() { return this.state !== 'alive' }

  hit() {
    if (this.state !== 'alive' || this.invincible > 0) return false
    this.state = 'dead'; this.justDied = true; this.respawnTimer = PLAYER.respawnDelay
    this.sprite.visible = false
    return true
  }

  /** Brief invincibility from an outside source. */
  grantInvincibility(seconds: number) {
    if (this.state !== 'alive') return
    this.invincible = Math.max(this.invincible, seconds)
    this.flashTimer = 0
  }

  consumeJustDied() { if (!this.justDied) return false; this.justDied = false; return true }
  reset() {
    this.state = 'alive'; this.justDied = false; this.invincible = 0; this.tilt = 0; this.fireTimer = 0
    this.sprite.rotation = 0; this.sprite.visible = true; this.sprite.alpha = 1; this.sprite.tint = 0xffffff
    this.sprite.x = PLAYFIELD_CENTER; this.sprite.y = this.stageH * 0.8
  }

  update(dt: number, actions: Actions) {
    if (this.state === 'dead') {
      this.respawnTimer -= dt
      if (this.respawnTimer <= 0) { this.state = 'respawning'; this.sprite.visible = true; this.sprite.x = PLAYFIELD_CENTER; this.sprite.y = this.stageH + 50; this.sprite.rotation = 0; this.tilt = 0; this.invincible = PLAYER.respawnInvincible; this.flashTimer = 0 }
      return
    }
    if (this.state === 'respawning') {
      this.sprite.y -= PLAYER.respawnFlySpeed * dt; this.invincible -= dt; this.flashTimer += dt
      this.sprite.alpha = Math.sin(this.flashTimer * 20) > 0 ? 1 : 0.3
      if (this.sprite.y <= this.stageH * 0.8) { this.sprite.y = this.stageH * 0.8; this.state = 'alive' }
      return
    }

    const { moveX, moveY } = actions
    const len = Math.sqrt(moveX * moveX + moveY * moveY) || 1
    this.sprite.x += (moveX / len) * SPEED * dt; this.sprite.y += (moveY / len) * SPEED * dt
    if (actions.touchActive) { this.sprite.x += actions.touchDX; this.sprite.y += actions.touchDY }
    const hw = this.sprite.width / 2, hh = this.sprite.height / 2
    this.sprite.x = Math.max(PLAYFIELD_LEFT + hw, Math.min(PLAYFIELD_RIGHT - hw, this.sprite.x))
    this.sprite.y = Math.max(hh, Math.min(this.stageH - hh, this.sprite.y))
    const tiltInput = Math.max(-1, Math.min(1, moveX + (actions.touchActive ? actions.touchDX * 0.12 : 0)))
    this.tilt += (tiltInput * PLAYER.bankAngle - this.tilt) * Math.min(1, 12 * dt); this.sprite.rotation = this.tilt

    // Auto-fire: the normal shot is always on, so attention stays on the core.
    this.fireTimer -= dt
    if (this.fireTimer <= 0) {
      this.fireTimer = PLAYER.fireInterval
      const ox = this.sprite.x, oy = this.sprite.y - 20
      for (const [nx, ny] of PLAYER.shotPattern) {
        this.bulletPool.acquire(ox, oy, nx * PLAYER.bulletSpeed, ny * PLAYER.bulletSpeed, PLAYER.shotDamage)
      }
      audioSystem.playShoot()
    }

    if (this.invincible > 0) { this.invincible -= dt; this.flashTimer += dt; this.sprite.alpha = Math.sin(this.flashTimer * 20) > 0 ? 1 : 0.3 } else this.sprite.alpha = 1
  }
}
