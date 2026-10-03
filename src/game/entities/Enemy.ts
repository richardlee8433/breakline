import { Container, Sprite, Texture, Graphics } from 'pixi.js'
import { EnemyDef } from '../data/enemies'
import { CHASE, LOCK } from '../data/chase'
import { BulletPool } from './BulletPool'
import { fireAimedFan } from '../systems/BulletPatterns'
import { STAGE_H, PLAYFIELD_LEFT, PLAYFIELD_RIGHT, SPRITE_SCALE } from '../config'
import { audioSystem } from '../systems/AudioSystem'

/** Hostile fire is pooled by kind, so "is this harmless energy?" is answered
 *  by which pool a round lives in rather than by a per-bullet flag. */
export interface HostilePools {
  energy: BulletPool
  missile: BulletPool
}

/**
 * warn  — not on screen yet; a marker at the bottom edge says where it comes in
 * chase — on station behind the ship, changing lanes and attacking
 * dark  — hit by an EMP: no thrust, no fire, no ram damage; drifts back
 * leave — chase time is up; falls back off the bottom on its own
 */
export type ChaserState = 'warn' | 'chase' | 'dark' | 'leave'

const MIN_GAP = CHASE.minGap * SPRITE_SCALE
const SPREAD = CHASE.laneSpread * SPRITE_SCALE
const DRIFT = CHASE.driftSpeed * SPRITE_SCALE
const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** A pursuer. Every active enemy enters from behind (below) and never
 *  overtakes the ship. */
export class Enemy {
  sprite: Sprite
  active = false
  state: ChaserState = 'warn'
  /** Scalar AABB half-extents (no Rectangle allocation in the hot loop). */
  halfW = 10
  halfH = 10
  def!: EnemyDef

  private x0 = 0               // entry x, for the warning marker
  private warnT = 0
  private chaseAge = 0
  private lane = 0             // station offset from the ship's x
  private depth = 0            // station distance below the ship
  private repositionT = 0
  private onStation = false
  private fireT = 0
  private lockT = -1           // >= 0 while a missile lock is running
  private darkT = 0
  private age = 0
  private engineG = new Graphics()
  private fxG = new Graphics()

  constructor(container: Container, texture: Texture) {
    this.sprite = new Sprite(texture)
    this.sprite.anchor.set(0.5)
    this.sprite.visible = false
    container.addChild(this.engineG, this.sprite, this.fxG)
  }

  /** True while its hull hurts on contact. */
  get harmful() { return this.active && (this.state === 'chase' || this.state === 'leave') }
  /** A missile lock is running (marker on the ship, launch imminent). */
  get locking() { return this.lockT >= 0 }
  /** Can an EMP reach it (it is on screen and running)? */
  get empable() { return this.active && (this.state === 'chase' || this.state === 'leave') }

  activate(x: number, def: EnemyDef, texture: Texture, playerX: number) {
    this.def = def
    this.state = 'warn'
    this.warnT = CHASE.warnTime
    this.x0 = x
    this.chaseAge = 0
    this.age = 0
    this.lane = Math.max(-SPREAD, Math.min(SPREAD, x - playerX))
    this.depth = rand(CHASE.depthMin, CHASE.depthMax) * SPRITE_SCALE
    this.repositionT = rand(CHASE.repositionMin, CHASE.repositionMax)
    this.onStation = false
    this.fireT = CHASE.firstShot
    this.lockT = -1
    this.darkT = 0
    this.sprite.texture = texture
    this.sprite.scale.set(def.scale * SPRITE_SCALE)
    this.sprite.rotation = 0           // nose up: chasing the ship
    this.sprite.tint = 0xffffff
    this.sprite.alpha = 1
    this.sprite.x = x
    this.sprite.y = STAGE_H + this.sprite.height
    this.sprite.visible = false
    this.halfW = this.sprite.width * 0.3
    this.halfH = this.sprite.height * 0.3
    this.engineG.visible = this.fxG.visible = true
    this.active = true
  }

  deactivate() {
    this.active = false
    this.sprite.visible = false
    this.engineG.clear(); this.fxG.clear()
    this.engineG.visible = this.fxG.visible = false
  }

  /** EMP hit: go dark for `seconds`. Cancels a running missile lock. */
  disable(seconds: number) {
    if (!this.empable) return
    this.state = 'dark'
    this.darkT = seconds
    this.lockT = -1
    this.sprite.tint = 0x5a6478
  }

  /** Returns true when a dark pursuer drifts off the bottom: shaken off. */
  update(dt: number, pools: HostilePools, px: number, py: number): boolean {
    if (!this.active) return false
    this.age += dt
    const s = this.sprite
    const hh = s.height / 2, hw = s.width / 2

    switch (this.state) {
      case 'warn':
        this.warnT -= dt
        if (this.warnT <= 0) {
          this.state = 'chase'
          s.visible = true
          s.y = STAGE_H + hh
        }
        break

      case 'chase': {
        this.chaseAge += dt
        this.repositionT -= dt
        if (this.repositionT <= 0) {
          // Change lanes behind the ship: the pursuit shifts, never passes.
          this.repositionT = rand(CHASE.repositionMin, CHASE.repositionMax)
          this.lane = rand(-SPREAD, SPREAD)
          this.depth = rand(CHASE.depthMin, CHASE.depthMax) * SPRITE_SCALE
        }
        const tx = Math.max(PLAYFIELD_LEFT + hw, Math.min(PLAYFIELD_RIGHT - hw, px + this.lane))
        const ty = Math.min(STAGE_H - hh * 0.6, Math.max(py + MIN_GAP, py + this.depth))
        const dx = tx - s.x, dy = ty - s.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const step = Math.min(dist, Math.min(this.def.speed * SPRITE_SCALE, dist * 3) * dt)
        if (dist > 0.5) { s.x += (dx / dist) * step; s.y += (dy / dist) * step }
        if (!this.onStation && dist < 40 * SPRITE_SCALE) this.onStation = true
        // Bank into lateral moves.
        s.rotation += (Math.max(-1, Math.min(1, dx / (60 * SPRITE_SCALE))) * 0.25 - s.rotation) * Math.min(1, 8 * dt)
        if (this.onStation) this.attack(dt, pools, px, py)
        if (this.chaseAge >= this.def.chaseTime && this.lockT < 0) this.state = 'leave'
        break
      }

      case 'dark':
        // No thrust: the scenery (and the ship) leave it behind.
        this.darkT -= dt
        s.y += DRIFT * dt
        s.rotation *= 1 - Math.min(1, 3 * dt)
        if (s.y > STAGE_H + hh) { this.deactivate(); return true }
        if (this.darkT <= 0) {
          this.state = 'chase'
          this.sprite.tint = 0xffffff
          this.fireT = CHASE.firstShot
        }
        break

      case 'leave':
        s.y += this.def.speed * SPRITE_SCALE * 0.9 * dt
        if (s.y > STAGE_H + hh) { this.deactivate(); return false }
        break
    }

    this.draw(px, py)
    return false
  }

  private attack(dt: number, pools: HostilePools, px: number, py: number) {
    if (this.lockT >= 0) {
      this.lockT -= dt
      if (this.lockT < 0) this.fireMissile(pools.missile, px, py)
      return
    }
    this.fireT -= dt
    if (this.fireT > 0) return
    this.fireT = this.def.fireRate * rand(0.85, 1.15)
    if (this.def.attack === 'missile') {
      // Lock first: a marker on the ship and a cue, then the launch.
      this.lockT = LOCK.time
      audioSystem.playMissileLock()
    } else {
      fireAimedFan(pools.energy, this.sprite.x, this.sprite.y - this.sprite.height * 0.4,
        this.def.bulletSpeed, this.def.fanCount ?? 3, 0.36, px, py)
    }
  }

  private fireMissile(pool: BulletPool, px: number, py: number) {
    const x = this.sprite.x, y = this.sprite.y - this.sprite.height * 0.45
    const dx = px - x, dy = py - y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    pool.acquire(x, y, (dx / len) * this.def.bulletSpeed, (dy / len) * this.def.bulletSpeed)
    audioSystem.playMissileLaunch()
  }

  private draw(px: number, py: number) {
    const s = this.sprite
    this.engineG.clear()
    this.fxG.clear()

    if (this.state === 'warn') {
      // Entry marker on the bottom edge: a pulsing chevron in the pursuer's
      // engine colour, brightening as it is about to appear.
      const k = SPRITE_SCALE
      const p = 1 - this.warnT / CHASE.warnTime
      const a = 0.45 + 0.55 * Math.abs(Math.sin(this.age * 14))
      const y = STAGE_H - 16 * k, x = this.x0
      this.fxG.poly([x, y - 12 * k, x + 13 * k, y + 6 * k, x - 13 * k, y + 6 * k])
        .fill({ color: this.def.engineColor, alpha: a * (0.5 + 0.5 * p) })
      this.fxG.rect(x - 22 * k, STAGE_H - 4 * k, 44 * k, 4 * k)
        .fill({ color: this.def.engineColor, alpha: 0.35 + 0.4 * p })
      return
    }

    if (this.state === 'dark') {
      // Dead engine: crackle instead of a flame.
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2, r = s.width * 0.35
        this.fxG.moveTo(s.x + Math.cos(a) * r * 0.3, s.y + Math.sin(a) * r * 0.3)
          .lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r)
          .stroke({ color: 0x9fdcff, width: 1.5, alpha: 0.9 })
      }
      return
    }

    // Engine flame behind the hull (below it: the ship flies up-screen).
    const pulse = 0.72 + 0.28 * Math.sin(this.age * 18 + s.x * 0.03)
    const tailY = s.y + s.height * 0.43
    const spread = s.width * 0.16
    const n = this.def.engineCount
    for (let i = 0; i < n; i++) {
      const ox = n === 1 ? 0 : (i - (n - 1) / 2) * spread
      this.engineG.ellipse(s.x + ox, tailY + 4 * pulse, 5.5, 11 + 5 * pulse)
        .fill({ color: this.def.engineColor, alpha: 0.18 * pulse })
      this.engineG.ellipse(s.x + ox, tailY, 2.3, 5 + 2.5 * pulse)
        .fill({ color: 0xffffff, alpha: 0.7 * pulse })
    }

    if (this.lockT >= 0) {
      // Lock: a line to the ship and brackets closing in on it.
      const p = 1 - this.lockT / LOCK.time
      const blink = Math.sin(this.age * 40) > 0 ? 1 : 0.45
      this.fxG.moveTo(s.x, s.y - s.height * 0.45).lineTo(px, py)
        .stroke({ color: 0xff6a2a, width: 1.5, alpha: 0.5 * blink })
      const r = (34 - 16 * p) * SPRITE_SCALE, c = r * 0.45
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        this.fxG.moveTo(px + sx * r, py + sy * (r - c)).lineTo(px + sx * r, py + sy * r)
          .lineTo(px + sx * (r - c), py + sy * r)
      }
      this.fxG.stroke({ color: 0xff7a30, width: 2, alpha: blink })
    }
  }
}
