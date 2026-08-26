import { Container, Sprite, Texture, Rectangle, Graphics } from 'pixi.js'
import { Actions } from '../systems/InputSystem'
import { BulletPool } from './BulletPool'
import { gameStore } from '../../store/gameStore'
import { audioSystem } from '../systems/AudioSystem'
import { PLAYFIELD_LEFT, PLAYFIELD_RIGHT, PLAYFIELD_W, SPRITE_SCALE } from '../config'
import { burstTier } from '../data/burst'

const SPEED = 300 * SPRITE_SCALE
const PLAYFIELD_CENTER = PLAYFIELD_LEFT + PLAYFIELD_W / 2
const FOCUS_SPEED_MULT = 0.4
const BANK_ANGLE = 0.22
const RESPAWN_DELAY = 1.1
const RESPAWN_FLY_SPEED = 300
const RESPAWN_INVINCIBLE = 3
const DEATHBOMB_WINDOW = 0.15
const DEATHBOMB_IFRAMES = 1.5
const HITBOX_SIZE = 6 * SPRITE_SCALE
const SHIP_DISPLAY_H = 72
const BULLET_SPEED = 620

const VULCAN_PATTERNS: [number, number][][] = [
  [[0, -1]],
  [[-0.07, -1], [0.07, -1]],
  [[-0.10, -0.995], [0, -1], [0.10, -0.995]],
  [[-0.14, -0.99], [-0.04, -1], [0.04, -1], [0.14, -0.99]],
  [[-0.16, -0.987], [-0.08, -0.997], [0, -1], [0.08, -0.997], [0.16, -0.987]],
]

const PLASMA_PATTERNS: [number, number][][] = [
  [[-0.55, -0.84], [-0.28, -0.96], [0, -1], [0.28, -0.96], [0.55, -0.84]],
  [[-0.60, -0.80], [-0.30, -0.95], [0, -1], [0.30, -0.95], [0.60, -0.80]],
  [[-0.62, -0.78], [-0.42, -0.91], [-0.21, -0.98], [0, -1], [0.21, -0.98], [0.42, -0.91], [0.62, -0.78]],
  [[-0.66, -0.75], [-0.44, -0.90], [-0.22, -0.98], [0, -1], [0.22, -0.98], [0.44, -0.90], [0.66, -0.75]],
  [[-0.70, -0.71], [-0.52, -0.85], [-0.35, -0.94], [-0.18, -0.98], [0, -1], [0.18, -0.98], [0.35, -0.94], [0.52, -0.85], [0.70, -0.71]],
]

const VULCAN_FIRE_RATE = [0.14, 0.13, 0.12, 0.10, 0.08]
const PLASMA_FIRE_RATE = [0.34, 0.32, 0.30, 0.27, 0.24]

export class Player {
  sprite: Sprite
  hitbox: Rectangle
  active = true
  firingLaser = false
  private fireTimer = 0
  private invincible = 0
  private flashTimer = 0
  private focusDot: Graphics
  private dotPulse = 0
  private state: 'alive' | 'grace' | 'dead' | 'respawning' = 'alive'
  private respawnTimer = 0
  private graceTimer = 0
  private justDied = false
  private tilt = 0

  constructor(container: Container, texture: Texture, private bulletPool: BulletPool, private plasmaTexture: Texture, private stageW: number, private stageH: number) {
    this.sprite = new Sprite(texture)
    this.sprite.anchor.set(0.5)
    this.sprite.x = PLAYFIELD_CENTER
    this.sprite.y = stageH * 0.8
    this.sprite.scale.set(SHIP_DISPLAY_H * SPRITE_SCALE / texture.height)
    container.addChild(this.sprite)
    const half = HITBOX_SIZE / 2
    this.hitbox = new Rectangle(-half, -half, HITBOX_SIZE, HITBOX_SIZE)
    this.focusDot = new Graphics()
    this.focusDot.circle(0, 0, 5.5 * SPRITE_SCALE).fill({ color: 0xff3366, alpha: 0.55 })
    this.focusDot.circle(0, 0, 2.5 * SPRITE_SCALE).fill(0xffffff)
    this.focusDot.visible = false
    container.addChild(this.focusDot)
  }

  get x() { return this.sprite.x }
  get y() { return this.sprite.y }
  get hitboxWorld(): Rectangle { return new Rectangle(this.sprite.x + this.hitbox.x, this.sprite.y + this.hitbox.y, this.hitbox.width, this.hitbox.height) }
  get isDead() { return this.state !== 'alive' }
  get inGrace() { return this.state === 'grace' }

  hit() {
    if (this.state !== 'alive' || this.invincible > 0) return false
    this.state = 'grace'; this.graceTimer = DEATHBOMB_WINDOW; return true
  }

  /** Brief invincibility from an outside source (the BURST ignition blast). */
  grantInvincibility(seconds: number) {
    if (this.state !== 'alive') return
    this.invincible = Math.max(this.invincible, seconds)
    this.flashTimer = 0
  }

  cancelDeath() {
    if (this.state !== 'grace') return
    this.state = 'alive'; this.invincible = DEATHBOMB_IFRAMES; this.flashTimer = 0; this.sprite.tint = 0xffffff
  }
  consumeJustDied() { if (!this.justDied) return false; this.justDied = false; return true }
  reset() {
    this.state = 'alive'; this.justDied = false; this.graceTimer = 0; this.invincible = 0; this.tilt = 0
    this.sprite.rotation = 0; this.sprite.visible = true; this.sprite.alpha = 1; this.sprite.tint = 0xffffff
    this.sprite.x = PLAYFIELD_CENTER; this.sprite.y = this.stageH * 0.8
  }

  update(dt: number, actions: Actions) {
    if (this.state === 'grace') {
      this.graceTimer -= dt
      this.sprite.tint = Math.sin(this.graceTimer * 80) > 0 ? 0xff4444 : 0xffffff
      if (this.graceTimer <= 0) { this.sprite.tint = 0xffffff; this.state = 'dead'; this.justDied = true; this.respawnTimer = RESPAWN_DELAY; this.sprite.visible = false; this.focusDot.visible = false }
      return
    }
    if (this.state === 'dead') {
      this.respawnTimer -= dt
      if (this.respawnTimer <= 0) { this.state = 'respawning'; this.sprite.visible = true; this.sprite.x = PLAYFIELD_CENTER; this.sprite.y = this.stageH + 50; this.sprite.rotation = 0; this.tilt = 0; this.invincible = RESPAWN_INVINCIBLE; this.flashTimer = 0 }
      return
    }
    if (this.state === 'respawning') {
      this.sprite.y -= RESPAWN_FLY_SPEED * dt; this.invincible -= dt; this.flashTimer += dt
      this.sprite.alpha = Math.sin(this.flashTimer * 20) > 0 ? 1 : 0.3
      if (this.sprite.y <= this.stageH * 0.8) { this.sprite.y = this.stageH * 0.8; this.state = 'alive' }
      return
    }

    const { moveX, moveY, fire, focus } = actions
    const speed = focus ? SPEED * FOCUS_SPEED_MULT : SPEED
    const len = Math.sqrt(moveX * moveX + moveY * moveY) || 1
    this.sprite.x += (moveX / len) * speed * dt; this.sprite.y += (moveY / len) * speed * dt
    if (actions.touchActive) { this.sprite.x += actions.touchDX; this.sprite.y += actions.touchDY }
    const hw = this.sprite.width / 2, hh = this.sprite.height / 2
    this.sprite.x = Math.max(PLAYFIELD_LEFT + hw, Math.min(PLAYFIELD_RIGHT - hw, this.sprite.x))
    this.sprite.y = Math.max(hh, Math.min(this.stageH - hh, this.sprite.y))
    const tiltInput = Math.max(-1, Math.min(1, moveX + (actions.touchActive ? actions.touchDX * 0.12 : 0)))
    this.tilt += (tiltInput * BANK_ANGLE - this.tilt) * Math.min(1, 12 * dt); this.sprite.rotation = this.tilt

    const state = gameStore.getState(); const weapon = state.weapon
    const power = weapon === 'plasma' ? Math.min(4, Math.max(0, state.plasmaPower)) : Math.min(4, Math.max(0, state.power))
    this.firingLaser = fire && weapon === 'laser' && state.laserPower > 0

    // BURST is the only thing that changes the ship's own output: faster
    // cadence and heavier rounds for as long as the gauge holds.
    const tier = burstTier(state.burstLevel)
    const baseRate = weapon === 'plasma' ? PLASMA_FIRE_RATE[power] : VULCAN_FIRE_RATE[power]
    const rate = baseRate * tier.fireRateMult
    const pattern = weapon === 'plasma' ? PLASMA_PATTERNS[power] : VULCAN_PATTERNS[power]
    this.fireTimer -= dt
    if (fire && weapon !== 'laser' && this.fireTimer <= 0) {
      this.fireTimer = rate
      const ox = this.sprite.x, oy = this.sprite.y - 20
      for (const [nx, ny] of pattern) {
        const plasma = weapon === 'plasma'
        this.bulletPool.acquire(
          ox, oy,
          nx * (plasma ? BULLET_SPEED * 0.82 : BULLET_SPEED),
          ny * (plasma ? BULLET_SPEED * 0.82 : BULLET_SPEED),
          (plasma ? 0.55 : 1) * tier.damageMult,
          tier.tint,
          (plasma ? 1.1 : 1) * (state.burstLevel > 0 ? 1.25 : 1),
          plasma ? this.plasmaTexture : undefined,
          plasma, plasma,   // cancelsHostile, penetrates — both Plasma's identity
        )
      }
      audioSystem.playShoot(power)
    }

    if (this.invincible > 0) { this.invincible -= dt; this.flashTimer += dt; this.sprite.alpha = Math.sin(this.flashTimer * 20) > 0 ? 1 : 0.3 } else this.sprite.alpha = 1
    // Hull runs hot while bursting. Safe to assign unconditionally here: the
    // grace flash owns the tint in its own branch and returns before this.
    this.sprite.tint = tier.tint
    this.focusDot.visible = focus
    if (focus) { this.dotPulse += dt; this.focusDot.x = this.sprite.x; this.focusDot.y = this.sprite.y; this.focusDot.scale.set(1 + 0.15 * Math.sin(this.dotPulse * 8)) }
  }
}
