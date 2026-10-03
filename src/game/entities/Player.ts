import { Container, Sprite, Texture, Rectangle } from 'pixi.js'
import { Actions } from '../systems/InputSystem'
import { BulletPool } from './BulletPool'
import { audioSystem } from '../systems/AudioSystem'
import { PLAYFIELD_LEFT, PLAYFIELD_RIGHT, PLAYFIELD_W, SPRITE_SCALE } from '../config'
import { PLAYER } from '../data/player'
import { DASH, SHIELD } from '../data/core'
import type { HitCause } from '../../store/gameStore'

const SPEED = PLAYER.speed * SPRITE_SCALE
const PLAYFIELD_CENTER = PLAYFIELD_LEFT + PLAYFIELD_W / 2
const HITBOX_SIZE = PLAYER.hitboxSize * SPRITE_SCALE
const DASH_SPEED = DASH.distance * SPRITE_SCALE / DASH.duration
const GHOSTS = 5
const GHOST_LIFE = 0.22

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
  /** What caused the most recent death, for the playtest report. */
  lastHitCause: HitCause = 'energy'
  /** Asked before a hit kills: return true if a shield took it instead.
   *  GameApp wires this to the core. */
  shieldHook: ((cause: HitCause) => boolean) | null = null
  private tilt = 0
  private dashTime = 0
  private dashCd = 0
  private dashVx = 0
  private dashVy = 0
  private ghostTimer = 0
  private ghosts: { sprite: Sprite; life: number }[] = []

  constructor(container: Container, texture: Texture, private bulletPool: BulletPool, private stageH: number) {
    // Dash afterimages sit under the ship, pooled like everything else.
    for (let i = 0; i < GHOSTS; i++) {
      const g = new Sprite(texture)
      g.anchor.set(0.5)
      g.tint = 0x66eeff
      g.visible = false
      container.addChild(g)
      this.ghosts.push({ sprite: g, life: 0 })
    }
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
  /** While dashing the ship passes through bullets and missiles — but not
   *  through enemy hulls or continuous beams (game plan §4). */
  get isDashing() { return this.dashTime > 0 }
  /** 0 = just used, 1 = ready. For the HUD. */
  get dashCharge() { return 1 - Math.max(0, this.dashCd) / DASH.cooldown }

  /** Short burst of movement in the held direction (straight up if none). */
  tryDash(actions: Actions): boolean {
    if (this.state !== 'alive' || this.dashCd > 0) return false
    let dx = actions.moveX + (actions.touchActive ? actions.touchDX : 0)
    let dy = actions.moveY + (actions.touchActive ? actions.touchDY : 0)
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.01) { dx = 0; dy = -1 } else { dx /= len; dy /= len }
    this.dashVx = dx * DASH_SPEED; this.dashVy = dy * DASH_SPEED
    this.dashTime = DASH.duration; this.dashCd = DASH.cooldown; this.ghostTimer = 0
    audioSystem.playDash()
    return true
  }

  /** A hit connects. Returns true if it landed (the bullet is spent), either
   *  on the shield or on the ship. */
  hit(cause: HitCause) {
    if (this.state !== 'alive' || this.invincible > 0) return false
    if (this.shieldHook?.(cause)) {
      this.invincible = SHIELD.iframes; this.flashTimer = 0
      return true
    }
    this.lastHitCause = cause
    this.state = 'dead'; this.justDied = true; this.respawnTimer = PLAYER.respawnDelay
    this.sprite.visible = false; this.dashTime = 0
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
    this.dashTime = 0; this.dashCd = 0
    for (const g of this.ghosts) { g.life = 0; g.sprite.visible = false }
    this.sprite.rotation = 0; this.sprite.visible = true; this.sprite.alpha = 1; this.sprite.tint = 0xffffff
    this.sprite.x = PLAYFIELD_CENTER; this.sprite.y = this.stageH * 0.8
  }

  /** `absorbing`: the core's window is open, which pauses the normal shot.
   *  `level`: gun level 0–4 from the core's energy. */
  update(dt: number, actions: Actions, absorbing = false, level = 0) {
    if (this.dashCd > 0) this.dashCd -= dt
    this.updateGhosts(dt)
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
    if (this.dashTime > 0) {
      // A dash owns the ship's motion for its whole duration.
      this.dashTime -= dt
      this.sprite.x += this.dashVx * dt; this.sprite.y += this.dashVy * dt
      this.ghostTimer -= dt
      if (this.ghostTimer <= 0) { this.ghostTimer = DASH.duration / GHOSTS; this.dropGhost() }
    } else {
      const len = Math.sqrt(moveX * moveX + moveY * moveY) || 1
      this.sprite.x += (moveX / len) * SPEED * dt; this.sprite.y += (moveY / len) * SPEED * dt
      if (actions.touchActive) { this.sprite.x += actions.touchDX; this.sprite.y += actions.touchDY }
    }
    const hw = this.sprite.width / 2, hh = this.sprite.height / 2
    this.sprite.x = Math.max(PLAYFIELD_LEFT + hw, Math.min(PLAYFIELD_RIGHT - hw, this.sprite.x))
    this.sprite.y = Math.max(hh, Math.min(this.stageH - hh, this.sprite.y))
    const tiltInput = Math.max(-1, Math.min(1, moveX + (actions.touchActive ? actions.touchDX * 0.12 : 0)))
    this.tilt += (tiltInput * PLAYER.bankAngle - this.tilt) * Math.min(1, 12 * dt); this.sprite.rotation = this.tilt

    // Auto-fire: the normal shot is always on, so attention stays on the core.
    // It pauses while the absorb window is open, so the core's defensive and
    // offensive modes are never both running at once.
    this.fireTimer -= dt
    if (this.fireTimer <= 0 && !absorbing) {
      const lv = Math.max(0, Math.min(PLAYER.shotPattern.length - 1, level))
      this.fireTimer = PLAYER.fireInterval[lv]
      const ox = this.sprite.x, oy = this.sprite.y - 20
      for (const [nx, ny] of PLAYER.shotPattern[lv]) {
        this.bulletPool.acquire(ox, oy, nx * PLAYER.bulletSpeed, ny * PLAYER.bulletSpeed, PLAYER.shotDamage)
      }
      audioSystem.playShoot()
    }

    if (this.invincible > 0) { this.invincible -= dt; this.flashTimer += dt; this.sprite.alpha = Math.sin(this.flashTimer * 20) > 0 ? 1 : 0.3 } else this.sprite.alpha = 1
  }

  private dropGhost() {
    const g = this.ghosts.find((g) => g.life <= 0) ?? this.ghosts[0]
    g.life = GHOST_LIFE
    g.sprite.x = this.sprite.x; g.sprite.y = this.sprite.y
    g.sprite.rotation = this.sprite.rotation
    g.sprite.scale.copyFrom(this.sprite.scale)
    g.sprite.visible = true
  }

  private updateGhosts(dt: number) {
    for (const g of this.ghosts) {
      if (g.life <= 0) continue
      g.life -= dt
      g.sprite.alpha = Math.max(0, g.life / GHOST_LIFE) * 0.55
      if (g.life <= 0) g.sprite.visible = false
    }
  }
}
