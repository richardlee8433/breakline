import { Container, Texture } from 'pixi.js'
import { StageConfig, ChaseWave, Lane } from '../data/stages'
import { ENEMIES, EnemyDef } from '../data/enemies'
import { Enemy, HostilePools } from '../entities/Enemy'
import { PLAYFIELD_LEFT, PLAYFIELD_W, SPRITE_SCALE } from '../config'

const POOL_SIZE = 60
/** Seconds between members of one wave reaching the bottom edge. */
const STAGGER = 0.35
/** Pursuers closer than this nudge apart instead of stacking up. */
const SEPARATION = 58 * SPRITE_SCALE

interface PendingSpawn { at: number; x: number; def: EnemyDef; tex: Texture }

/**
 * Releases pursuers on the stage's timeline. Every one comes in from the
 * bottom edge (behind the ship); nothing spawns ahead of it.
 */
export class WaveSystem {
  /** Every pooled enemy; check `.active` before touching one. */
  readonly enemies: Enemy[] = []
  private pending: PendingSpawn[] = []
  private textures = new Map<string, Texture>()
  private waves: ChaseWave[] = []
  private next = 0
  private elapsed = 0

  constructor(private container: Container) {}

  async loadTextures() {
    const loadTex = (src: string): Promise<Texture> =>
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(Texture.from(img))
        img.onerror = () => reject(new Error(`Failed to load: ${src}`))
        img.src = src
      })
    await Promise.all(Object.entries(ENEMIES).map(async ([key, def]) => {
      this.textures.set(key, await loadTex(def.sprite))
    }))
    const tex = this.textures.values().next().value as Texture
    for (let i = 0; i < POOL_SIZE; i++) this.enemies.push(new Enemy(this.container, tex))
  }

  loadStage(cfg: StageConfig) {
    this.waves = cfg.waves
    this.next = 0
    this.elapsed = 0
    this.dismissAll()
  }

  /** Advances the timeline and every pursuer. Returns how many pursuers
   *  were shaken off (drifted out while disabled) this frame. */
  update(dt: number, pools: HostilePools, px: number, py: number): number {
    this.elapsed += dt
    while (this.next < this.waves.length && this.elapsed >= this.waves[this.next].time) {
      this.schedule(this.waves[this.next++])
    }
    while (this.pending.length && this.elapsed >= this.pending[0].at) {
      const p = this.pending.shift()!
      const e = this.enemies.find((e) => !e.active)
      if (e) e.activate(p.x, p.def, p.tex, px)
    }
    let shaken = 0
    for (const e of this.enemies) {
      if (e.active && e.update(dt, pools, px, py)) shaken++
    }
    this.separate(dt)
    return shaken
  }

  /** Pursuers on station spread out sideways rather than piling onto one
   *  spot. A steering nudge, not collision: a dozen ships at most. */
  private separate(dt: number) {
    const list = this.enemies
    const k = Math.min(1, 6 * dt)
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      if (!a.active || a.state !== 'chase') continue
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]
        if (!b.active || b.state !== 'chase') continue
        const dx = b.sprite.x - a.sprite.x, dy = b.sprite.y - a.sprite.y
        if (Math.abs(dx) >= SEPARATION || Math.abs(dy) >= SEPARATION) continue
        const push = ((SEPARATION - Math.abs(dx)) / 2) * k * (dx >= 0 ? 1 : -1)
        a.nudge(-push)
        b.nudge(push)
      }
    }
  }

  private schedule(wave: ChaseWave) {
    const def = ENEMIES[wave.type], tex = this.textures.get(wave.type)
    if (!def || !tex) return
    const xs = laneXs(wave.lane, wave.count)
    for (let i = 0; i < wave.count; i++) {
      this.pending.push({ at: wave.time + i * STAGGER, x: xs[i], def, tex })
    }
    this.pending.sort((a, b) => a.at - b.at)
  }

  /** Stop the stage: nothing queued, nothing on the field. */
  dismissAll() {
    this.pending.length = 0
    for (const e of this.enemies) if (e.active) e.deactivate()
  }
}

/** Entry points along the bottom edge for a wave of `n`. */
function laneXs(lane: Lane, n: number): number[] {
  const at = (f: number) => PLAYFIELD_LEFT + PLAYFIELD_W * f
  const jitter = () => (Math.random() - 0.5) * PLAYFIELD_W * 0.08
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    switch (lane) {
      case 'center': out.push(at(0.5) + (i - (n - 1) / 2) * PLAYFIELD_W * 0.14); break
      case 'left':   out.push(at(0.22 + i * 0.12) + jitter()); break
      case 'right':  out.push(at(0.78 - i * 0.12) + jitter()); break
      case 'spread': out.push(at(n === 1 ? 0.5 : 0.15 + (0.7 * i) / (n - 1)) + jitter()); break
    }
  }
  return out
}
