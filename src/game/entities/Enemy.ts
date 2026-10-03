import { Container, Sprite, Texture, Rectangle, Graphics } from 'pixi.js'
import { EnemyDef } from '../data/enemies'
import { BulletPool } from './BulletPool'
import { EnemyPath } from '../data/stages'
import { fireRing, fireAimedFan } from '../systems/BulletPatterns'
import { STAGE_H, PLAYFIELD_LEFT, PLAYFIELD_RIGHT, SPRITE_SCALE } from '../config'
import { audioSystem } from '../systems/AudioSystem'

export type { EnemyPath }

/** Hostile fire is pooled by kind, so "can this be absorbed?" is answered
 *  by which pool a round lives in rather than by a per-bullet flag. */
export interface HostilePools {
  energy: BulletPool
  missile: BulletPool
}

export class Enemy {
  sprite: Sprite
  hitbox: Rectangle
  active = false
  hp = 1
  scoreValue = 100

  private def!: EnemyDef
  private path: EnemyPath = 'straight'
  private age = 0
  private zigzagDir = 1
  private playerX = 240
  private diagVx = 0
  private spawnX = 0
  private laserG: Graphics | null = null
  private laserTimer = 0
  private laserDuration = 0
  private spiralAngle = 0
  private hitFlash = 0
  private hitBurst = 0
  private hitAngle = 0
  private fireTimer = 0
  private engineG: Graphics
  private hitG: Graphics
  private aimVx = 0
  private aimVy = 1
  private diveLocked = false
  private hoverY = 0
  private hoverPhase: 0 | 1 | 2 = 0   // descending → holding station → leaving
  private hoverAge = 0

  constructor(private container: Container, texture: Texture) {
    this.engineG = new Graphics()
    this.hitG = new Graphics()
    this.sprite = new Sprite(texture)
    this.sprite.anchor.set(0.5)
    this.sprite.visible = false
    this.engineG.visible = false
    this.hitG.visible = false
    container.addChild(this.engineG, this.sprite, this.hitG)
    this.hitbox = new Rectangle(-12, -12, 24, 24)
  }

  get activeLaser(): { x: number; fromY: number } | null {
    if (!this.def?.usesLaser || this.laserDuration <= 0) return null
    return { x: this.sprite.x, fromY: this.sprite.y }
  }

  activate(
    x: number, y: number,
    def: EnemyDef, path: EnemyPath,
    playerX: number, texture: Texture,
  ) {
    this.def = def
    this.path = path
    this.hp = def.hp
    this.scoreValue = def.scoreValue
    this.age = 0
    this.spawnX = x
    this.playerX = playerX
    this.laserTimer = 1 + Math.random() * 1.5
    this.fireTimer = def.fireRate > 0
      ? def.fireRate * (0.35 + Math.random() * 0.65)
      : 0
    this.laserDuration = 0
    this.spiralAngle = Math.random() * Math.PI * 2
    if (def.usesLaser && !this.laserG) {
      this.laserG = new Graphics()
      this.container.addChild(this.laserG)
    }
    this.sprite.texture = texture
    this.sprite.x = x
    this.sprite.y = y
    this.sprite.scale.set(def.scale * SPRITE_SCALE)
    this.sprite.rotation = Math.PI
    this.sprite.alpha = 1
    this.sprite.tint = 0xffffff
    this.hitFlash = 0
    this.hitBurst = 0
    this.engineG.visible = true
    this.hitG.visible = true
    this.sprite.visible = true
    this.active = true

    this.diagVx = path === 'diagonal-left' ? -0.58 :
                  path === 'diagonal-right' ? 0.58 : 0
    this.aimVx = 0
    this.aimVy = 1
    this.diveLocked = false
    this.hoverY = STAGE_H * (0.14 + Math.random() * 0.14)
    this.hoverPhase = 0
    this.hoverAge = 0
    if (path === 'dive') this.lockDive(x, y, playerX)

    const hw = (this.sprite.width * 0.6) / 2
    const hh = (this.sprite.height * 0.6) / 2
    this.hitbox = new Rectangle(-hw, -hh, hw * 2, hh * 2)
  }

  deactivate() {
    this.active = false
    this.sprite.visible = false
    this.engineG.clear()
    this.hitG.clear()
    this.engineG.visible = false
    this.hitG.visible = false
    this.laserDuration = 0
    this.laserG?.clear()
  }

  get hitboxWorld(): Rectangle {
    return new Rectangle(
      this.sprite.x + this.hitbox.x,
      this.sprite.y + this.hitbox.y,
      this.hitbox.width,
      this.hitbox.height,
    )
  }

  flash() {
    if (this.hitFlash <= 0) {
      this.hitBurst = 0.13
      this.hitAngle = Math.random() * Math.PI * 2
    }
    this.hitFlash = 0.09
    this.sprite.tint = 0xff684f
  }

  update(dt: number, pools: HostilePools, stageH: number, playerX: number, playerY = 512) {
    if (!this.active) return
    this.age += dt

    if (this.hitFlash > 0) {
      this.hitFlash -= dt
      if (this.hitFlash <= 0) this.sprite.tint = 0xffffff
    }
    this.hitBurst = Math.max(0, this.hitBurst - dt)
    this.playerX = playerX
    const spd = this.def.speed

    switch (this.path) {
      case 'straight':
        this.sprite.y += spd * dt
        break

      case 'zigzag':
        this.sprite.y += spd * 0.7 * dt
        this.sprite.x += this.zigzagDir * spd * 0.8 * dt
        if (this.age % 1.2 < dt) this.zigzagDir *= -1
        break

      case 'sine':
        // Smooth weaving keeps the craft advancing while producing readable lanes.
        this.sprite.y += spd * 0.78 * dt
        this.sprite.x = this.spawnX + Math.sin(this.age * 2.6) * 78
        break

      case 'swoop-left':
      case 'swoop-right': {
        // A broad banking pass: strong lateral motion on entry, easing into a
        // downward exit. Unlike a dive it never homes on the player.
        const dir = this.path === 'swoop-left' ? -1 : 1
        const phase = Math.min(this.age / 2.4, 1)
        const lateral = dir * spd * (1.25 - phase * 0.95)
        this.sprite.x += lateral * dt
        this.sprite.y += spd * (0.48 + phase * 0.55) * dt
        break
      }

      case 'hover':
        // Drop in, hold station with a gentle sway while firing, then leave.
        // Gives the player a steady stream to practise reading and catching.
        if (this.hoverPhase === 0) {
          this.sprite.y += spd * dt
          if (this.sprite.y >= this.hoverY) this.hoverPhase = 1
        } else if (this.hoverPhase === 1) {
          this.hoverAge += dt
          this.sprite.x = this.spawnX + Math.sin(this.hoverAge * 1.3) * 22 * SPRITE_SCALE
          if (this.hoverAge >= (this.def.hoverTime ?? 6)) this.hoverPhase = 2
        } else {
          this.sprite.y += spd * 1.3 * dt
        }
        break

      case 'dive':
        this.sprite.x += this.aimVx * spd * dt
        this.sprite.y += this.aimVy * spd * dt
        break

      case 'diagonal-left':
      case 'diagonal-right': {
        if (!this.diveLocked) {
          this.sprite.y += spd * dt
          this.sprite.x += this.diagVx * spd * dt
          if (this.sprite.y >= stageH * 0.35) {
            this.lockDive(this.sprite.x, this.sprite.y, playerX)
          }
        } else {
          this.sprite.x += this.aimVx * spd * 0.9 * dt
          this.sprite.y += this.aimVy * spd * 0.9 * dt
        }
        break
      }
    }

    if (this.def.fireRate > 0) {
      this.fireTimer -= dt
      if (this.fireTimer <= 0) {
        this.fireTimer += this.def.fireRate
        if (this.fireTimer <= 0) this.fireTimer = this.def.fireRate
        this.fire(this.def.bulletKind === 'missile' ? pools.missile : pools.energy, playerX, playerY)
      }
    }

    if (
      this.sprite.y > stageH + 60 || this.sprite.y < -200 ||
      this.sprite.x < PLAYFIELD_LEFT - 160 || this.sprite.x > PLAYFIELD_RIGHT + 160 ||
      this.age > 30
    ) { this.deactivate(); return }

    this.drawVisualFx()

    if (this.def.usesLaser && this.laserG) {
      this.laserTimer -= dt
      if (this.laserTimer <= 0) {
        this.laserTimer = 2.8 + Math.random() * 0.4
        this.laserDuration = 0.55
      }
      if (this.laserDuration > 0) {
        this.laserDuration -= dt
        this.drawLaser(stageH)
      } else {
        this.laserG.clear()
      }
    }
  }

  private lockDive(x: number, y: number, targetX: number) {
    const dx = targetX - x
    const dy = (STAGE_H + 300) - y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    this.aimVx = dx / len
    this.aimVy = dy / len
    this.diveLocked = true
  }

  private fire(pool: BulletPool, playerX: number, playerY: number) {
    const x = this.sprite.x
    const y = this.sprite.y + 10
    const spd = this.def.bulletSpeed
    if (this.def.bulletKind === 'missile') audioSystem.playMissileLaunch()

    switch (this.def.attackType) {
      case 'aimed': {
        const dx = playerX - x
        const dy = playerY - y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        pool.acquire(x, y, (dx / len) * spd, (dy / len) * spd)
        break
      }
      case 'ring':
        fireRing(pool, x, y, spd, this.def.bulletCount ?? 8, this.spiralAngle)
        this.spiralAngle += 0.3
        break
      case 'spiral':
        fireRing(pool, x, y, spd, this.def.bulletCount ?? 2, this.spiralAngle)
        this.spiralAngle += 0.42
        break
      case 'aimed-fan':
        fireAimedFan(pool, x, y, spd, this.def.bulletCount ?? 3, 0.44, playerX, playerY)
        break
      case 'spread': {
        const count = this.def.spreadCount ?? 3
        const halfAngle = Math.PI / 6
        const step = count > 1 ? (halfAngle * 2) / (count - 1) : 0
        for (let i = 0; i < count; i++) {
          const a = -halfAngle + i * step
          pool.acquire(x, y, Math.sin(a) * spd, Math.cos(a) * spd)
        }
        break
      }
      default:
        pool.acquire(x, y, 0, spd)
    }
  }

  private drawLaser(stageH: number) {
    if (!this.laserG) return
    const g = this.laserG
    const x = this.sprite.x
    const y = this.sprite.y
    const pulse = 0.82 + 0.18 * Math.sin(Date.now() * 0.028)
    g.clear()
    g.moveTo(x, y).lineTo(x, stageH).stroke({ color: 0x550000, width: 26, alpha: 0.06 * pulse })
    g.moveTo(x, y).lineTo(x, stageH).stroke({ color: 0xff2200, width: 12, alpha: 0.20 * pulse })
    g.moveTo(x, y).lineTo(x, stageH).stroke({ color: 0xff6633, width: 5, alpha: 0.60 * pulse })
    g.moveTo(x, y).lineTo(x, stageH).stroke({ color: 0xffddcc, width: 2, alpha: 0.95 * pulse })
    g.circle(x, y + 4, 8 + 3 * pulse).stroke({ color: 0xff4422, width: 1.5, alpha: 0.5 })
  }

  private drawVisualFx() {
    const x = this.sprite.x
    const y = this.sprite.y
    const pulse = 0.72 + 0.28 * Math.sin(this.age * 18 + x * 0.03)
    const color = this.def.engineColor ?? 0x55ddff
    const count = this.def.engineCount ?? 1
    const tailY = y - this.sprite.height * 0.43
    const spread = this.sprite.width * 0.16

    this.engineG.clear()
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread
      this.engineG.ellipse(x + offset, tailY - 3 * pulse, 5.5, 10 + 4 * pulse)
        .fill({ color, alpha: 0.12 * pulse })
      this.engineG.ellipse(x + offset, tailY, 2.3, 5 + 2.5 * pulse)
        .fill({ color: 0xffffff, alpha: 0.68 * pulse })
    }

    this.hitG.clear()
    if (this.hitBurst > 0) {
      const p = 1 - this.hitBurst / 0.13
      const radius = 5 + p * 14
      for (let i = 0; i < 6; i++) {
        const a = this.hitAngle + i * Math.PI / 3
        const inner = radius * 0.32
        this.hitG.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
          .lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius)
          .stroke({ color: i % 2 ? 0xff8a36 : 0xffffff, width: 1.8, alpha: 1 - p })
      }
      this.hitG.circle(x, y, 3 + p * 4)
        .fill({ color: 0xffffff, alpha: (1 - p) * 0.85 })
    }
  }
}
