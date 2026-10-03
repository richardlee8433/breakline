import { Container, Texture } from 'pixi.js'
import { StageConfig, WaveEntry, EnemyPath, Formation } from '../data/stages'
import { ENEMIES, EnemyDef } from '../data/enemies'
import { Enemy, HostilePools } from '../entities/Enemy'
import { gameStore } from '../../store/gameStore'
import { STAGE_H, PLAYFIELD_LEFT, PLAYFIELD_RIGHT, FORMATION_SCALE } from '../config'

const POOL_SIZE = 160

const DEFAULT_INTERVAL: Record<Formation, number> = {
  'line-top': 0.12,
  'v-shape': 0.10,
  'line-left': 0.16,
  'line-right': 0.16,
  'arc-left': 0.11,
  'arc-right': 0.11,
  'split': 0.13,
  'pincer': 0.12,
}

interface PendingSpawn {
  releaseAt: number
  x: number
  y: number
  def: EnemyDef
  path: EnemyPath
  tex: Texture
}

export class WaveSystem {
  /** Every pooled enemy; check `.active` before touching one. */
  readonly enemies: Enemy[] = []
  private pending: PendingSpawn[] = []
  private textures = new Map<string, Texture>()
  private elapsed = 0
  private nextWaveIdx = 0
  private waves: WaveEntry[] = []
  private endTime = 42
  private hasBoss = false
  private densityMult = 1
  bossTriggered = false

  constructor(private container: Container) {}

  async loadTextures() {
    const loadTex = (src: string): Promise<Texture> =>
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(Texture.from(img))
        img.onerror = () => reject(new Error(`Failed to load: ${src}`))
        img.src = src
      })

    await Promise.all(
      Object.entries(ENEMIES).map(async ([key, def]) => {
        this.textures.set(key, await loadTex(def.sprite))
      }),
    )
    const defaultTex = this.textures.get('fighter')!
    for (let i = 0; i < POOL_SIZE; i++) {
      this.enemies.push(new Enemy(this.container, defaultTex))
    }
  }

  loadStage(cfg: StageConfig) {
    this.waves = cfg.waves
    this.endTime = cfg.endTime
    this.hasBoss = !!cfg.boss
    this.densityMult = cfg.densityMult
    this.elapsed = 0
    this.nextWaveIdx = 0
    this.bossTriggered = false
    this.dismissAll()
  }

  /** Pick the authored base encounter or one of its curated alternatives. */
  private resolveWave(entry: WaveEntry): WaveEntry {
    if (!entry.variants?.length) return entry
    const choices = [null, ...entry.variants]
    const variant = choices[Math.floor(Math.random() * choices.length)]
    if (!variant) return entry
    return {
      ...entry,
      count: variant.count ?? entry.count,
      formation: variant.formation ?? entry.formation,
      path: variant.path ?? entry.path,
      interval: variant.interval ?? entry.interval,
    }
  }

  private scheduleWave(source: WaveEntry) {
    const entry = this.resolveWave(source)
    let def: EnemyDef | undefined = ENEMIES[entry.type]
    if (!def) return
    const tex = this.textures.get(entry.type)
    if (!tex) return

    const rank = Math.min(gameStore.getState().loop - 1, 4)
    if (rank > 0) {
      def = {
        ...def,
        speed: def.speed * (1 + 0.12 * rank),
        bulletSpeed: def.bulletSpeed * (1 + 0.15 * rank),
        fireRate: def.fireRate / (1 + 0.1 * rank),
      }
    }

    const horizontal = ['line-top', 'v-shape', 'arc-left', 'arc-right', 'split', 'pincer']
      .includes(entry.formation)
    const count = Math.max(1, Math.round(entry.count * this.densityMult * (horizontal ? FORMATION_SCALE : 1)))
    const positions = formation(entry.formation, count, STAGE_H)
    const interval = entry.interval ?? DEFAULT_INTERVAL[entry.formation]

    for (let i = 0; i < count; i++) {
      const [x, y] = positions[i]
      this.pending.push({
        releaseAt: entry.time + i * interval,
        x, y, def, path: entry.path, tex,
      })
    }
    this.pending.sort((a, b) => a.releaseAt - b.releaseAt)
  }

  update(dt: number, pools: HostilePools, playerX: number, playerY: number, stageH: number)
    : { spawnBoss: boolean; activeLasers: Array<{ x: number; fromY: number }> } {
    this.elapsed += dt

    while (
      this.nextWaveIdx < this.waves.length &&
      this.elapsed >= this.waves[this.nextWaveIdx].time
    ) {
      this.scheduleWave(this.waves[this.nextWaveIdx])
      this.nextWaveIdx++
    }

    while (this.pending.length && this.elapsed >= this.pending[0].releaseAt) {
      const p = this.pending.shift()!
      const enemy = this.enemies.find((e) => !e.active)
      if (!enemy) continue
      enemy.activate(p.x, p.y, p.def, p.path, playerX, p.tex)
    }

    const activeLasers: Array<{ x: number; fromY: number }> = []
    for (const e of this.enemies) {
      if (!e.active) continue
      e.update(dt, pools, stageH, playerX, playerY)
      const laser = e.activeLaser
      if (laser) activeLasers.push(laser)
    }

    const spawnBoss = this.hasBoss && !this.bossTriggered && this.elapsed >= this.endTime
    if (spawnBoss) this.bossTriggered = true
    return { spawnBoss, activeLasers }
  }

  /** Boss-less stages: every wave has spawned, the end time has passed and
   *  nothing is left alive on the field. */
  get finished(): boolean {
    if (this.hasBoss || this.elapsed < this.endTime) return false
    if (this.nextWaveIdx < this.waves.length || this.pending.length) return false
    return !this.enemies.some((e) => e.active)
  }

  dismissAll() {
    this.pending.length = 0
    for (const e of this.enemies) e.deactivate()
  }
}

/** Lays out a squadron's entry points. Movement is handled independently by Enemy. */
function formation(type: Formation, count: number, stageH: number): [number, number][] {
  const out: [number, number][] = []
  const width = PLAYFIELD_RIGHT - PLAYFIELD_LEFT
  const center = (PLAYFIELD_LEFT + PLAYFIELD_RIGHT) / 2

  switch (type) {
    case 'line-top': {
      const spacing = Math.min(70, (width - 100) / Math.max(count - 1, 1))
      const totalW = spacing * (count - 1)
      const startX = PLAYFIELD_LEFT + (width - totalW) / 2
      for (let i = 0; i < count; i++) out.push([startX + i * spacing, -30])
      break
    }
    case 'line-left':
    case 'line-right': {
      const x = type === 'line-left' ? PLAYFIELD_LEFT - 30 : PLAYFIELD_RIGHT + 30
      const spacing = Math.min(55, (stageH * 0.6) / Math.max(count - 1, 1))
      for (let i = 0; i < count; i++) out.push([x, 80 + i * spacing])
      break
    }
    case 'v-shape': {
      const half = Math.floor(count / 2)
      const arm = half > 0 ? Math.min(70, (width / 2 - 60) / half) : 0
      for (let i = 0; i < count; i++) {
        const rank = Math.ceil(i / 2)
        const dir = i % 2 === 1 ? -1 : 1
        out.push([center + dir * rank * arm, -30 - rank * 20])
      }
      break
    }
    case 'arc-left':
    case 'arc-right': {
      const fromLeft = type === 'arc-left'
      const usable = width * 0.62
      for (let i = 0; i < count; i++) {
        const t = count <= 1 ? 0.5 : i / (count - 1)
        const x = fromLeft
          ? PLAYFIELD_LEFT - 35 + t * usable
          : PLAYFIELD_RIGHT + 35 - t * usable
        const y = -25 - Math.sin(t * Math.PI) * 105 - i * 7
        out.push([x, y])
      }
      break
    }
    case 'split': {
      const half = Math.ceil(count / 2)
      const spacing = Math.min(55, width * 0.34 / Math.max(half - 1, 1))
      for (let i = 0; i < count; i++) {
        const sideIndex = Math.floor(i / 2)
        const left = i % 2 === 0
        const x = left
          ? center - 55 - sideIndex * spacing
          : center + 55 + sideIndex * spacing
        out.push([x, -30 - sideIndex * 14])
      }
      break
    }
    case 'pincer': {
      const spacing = Math.min(52, (stageH * 0.34) / Math.max(Math.ceil(count / 2) - 1, 1))
      for (let i = 0; i < count; i++) {
        const rank = Math.floor(i / 2)
        const left = i % 2 === 0
        out.push([left ? PLAYFIELD_LEFT - 35 : PLAYFIELD_RIGHT + 35, 45 + rank * spacing])
      }
      break
    }
  }
  return out
}
