import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { ROCK, MINE, RockSize } from '../data/chase'
import { StageConfig, RockSegment, MineWave } from '../data/stages'
import { Player } from '../entities/Player'
import { ExplosionPool } from '../fx/Explosion'
import { loadTexture } from '../../assets/AssetLoader'
import { audioSystem } from './AudioSystem'
import { screenShake } from '../fx/ScreenShake'
import { STAGE_H, PLAYFIELD_LEFT, PLAYFIELD_RIGHT, PLAYFIELD_W, SPRITE_SCALE } from '../config'

const K = SPRITE_SCALE
const ROCK_V = ROCK.speed * K
const MINE_V = MINE.speed * K
const TRIGGER = MINE.triggerRadius * K
const BLAST = MINE.blastRadius * K
const MINE_R = (MINE.dia * K) / 2
const SIZES = Object.keys(ROCK.sizes) as RockSize[]
const rand = (a: number, b: number) => a + Math.random() * (b - a)
/** Seconds between the clear path's control points (value noise). */
const PATH_STEP = 1.2
/** Extra clearance kept between any two rocks (blue-noise spacing). */
const ROCK_SPACING = 6 * K
/** Placement attempts per arriving rock before it is dropped. */
const TRIES = 8
/** Every rock's center starts on this line, whatever its size, so that
 *  entry time maps to height the same way for all of them (the spacing and
 *  clear-path checks rely on it). */
const ROCK_Y0 = -(Math.max(...SIZES.map((s) => ROCK.sizes[s].dia)) * K) / 2

interface Rock { sprite: Sprite; active: boolean; r: number; spin: number }
/** idle → (ship within the trigger radius) armed → (fuse) blast → gone */
interface Mine { sprite: Sprite; active: boolean; state: 'idle' | 'armed' | 'blast'; t: number }
/** A hazard due to enter at `at`; its marker shows for the preview before. */
interface Pending { at: number; mine: boolean; x: number; size: RockSize; preview: number }
/** A placed rock, for spacing checks: all rocks fall at one speed, so the
 *  field is rigid and entry time stands in for height. */
interface Placed { at: number; x: number; r: number }

/**
 * Terrain ahead of the ship: asteroid rows (stage 2) and pre-laid proximity
 * mines (stage 3). Both scroll in from the top edge, each announced by a
 * marker there first. The EMP touches neither.
 */
export class HazardSystem {
  private rocks: Rock[] = []
  private mines: Mine[] = []
  private pending: Pending[] = []
  private g = new Graphics()
  private tex = new Map<RockSize, Texture>()
  private segs: RockSegment[] = []
  private mineWaves: MineWave[] = []
  private nextMine = 0
  private nextArrival = 0
  private placed: Placed[] = []
  /** Clear path center at each PATH_STEP of entry time. */
  private path: number[] = []
  private elapsed = 0
  private age = 0
  /** Something of each kind has come on screen this stage (for prompts). */
  rocksSeen = false
  minesSeen = false

  constructor(private container: Container) {}

  async load() {
    const [mineTex, ...rockTex] = await Promise.all(
      [MINE.src, ...SIZES.map((s) => ROCK.sizes[s].src)].map(loadTexture))
    SIZES.forEach((s, i) => this.tex.set(s, rockTex[i]))
    for (let i = 0; i < 48; i++) {
      const sprite = new Sprite(rockTex[0])
      sprite.anchor.set(0.5); sprite.visible = false
      this.container.addChild(sprite)
      this.rocks.push({ sprite, active: false, r: 0, spin: 0 })
    }
    for (let i = 0; i < 24; i++) {
      const sprite = new Sprite(mineTex)
      sprite.anchor.set(0.5); sprite.visible = false
      sprite.scale.set((MINE.dia * K) / Math.max(mineTex.width, mineTex.height))
      this.container.addChild(sprite)
      this.mines.push({ sprite, active: false, state: 'idle', t: 0 })
    }
    this.container.addChild(this.g)   // markers and mine rings on top
  }

  loadStage(cfg: StageConfig) {
    this.segs = cfg.rocks ?? []
    this.mineWaves = cfg.mines ?? []
    this.nextMine = 0
    this.nextArrival = 0
    this.placed.length = 0
    this.path.length = 0
    this.elapsed = 0
    this.rocksSeen = this.minesSeen = false
    this.clear()
  }

  clear() {
    this.pending.length = 0
    for (const r of this.rocks) { r.active = false; r.sprite.visible = false }
    for (const m of this.mines) { m.active = false; m.sprite.visible = false }
    this.g.clear()
  }

  update(dt: number, player: Player, explosions: ExplosionPool) {
    this.elapsed += dt
    this.age += dt
    this.schedule()
    while (this.pending.length && this.elapsed >= this.pending[0].at) this.spawn(this.pending.shift()!)

    const px = player.x, py = player.y, alive = !player.isDead
    const hitR = player.hitHalf

    for (const r of this.rocks) {
      if (!r.active) continue
      const s = r.sprite
      s.y += ROCK_V * dt
      s.rotation += r.spin * dt
      if (s.y > 0) this.rocksSeen = true
      if (s.y - s.height > STAGE_H) { r.active = false; s.visible = false; continue }
      // A rock is solid: touching it costs hull (then i-frames), and it
      // stays where it is — the ship has to get out of its way.
      if (alive) {
        const dx = s.x - px, dy = s.y - py, rr = r.r + hitR
        if (dx * dx + dy * dy < rr * rr) player.hit('rock')
      }
    }

    for (const m of this.mines) {
      if (!m.active) continue
      const s = m.sprite
      s.y += MINE_V * dt
      if (s.y > STAGE_H * 0.12) this.minesSeen = true   // fully in view
      const dx = s.x - px, dy = s.y - py
      if (m.state === 'idle') {
        if (s.y - MINE_R > STAGE_H) { m.active = false; s.visible = false; continue }
        // Entering the trigger radius (touching the body included) lights
        // the fuse. Leaving again does not stop it.
        if (alive && dx * dx + dy * dy <= TRIGGER * TRIGGER) {
          m.state = 'armed'; m.t = MINE.fuse
          audioSystem.playMineArm()
        }
      } else if (m.state === 'armed') {
        m.t -= dt
        s.tint = Math.sin(this.age * 40) > 0 ? 0xff4a3a : 0xffffff
        if (m.t <= 0) {
          // One blast, one damage check: the explosion fx never hits twice.
          m.state = 'blast'; m.t = MINE.blastFx
          s.visible = false
          explosions.spawn(s.x, s.y, 2.6)
          screenShake.trigger(5)
          audioSystem.playExplosion('large')
          const rr = BLAST + hitR
          if (alive && dx * dx + dy * dy <= rr * rr) player.hit('mine')
        }
      } else {
        m.t -= dt
        if (m.t <= 0) m.active = false
      }
    }

    this.draw()
  }

  /** Queue the rocks and mine patterns whose time has come; each enters
   *  after its preview. */
  private schedule() {
    const t = this.elapsed
    while (this.nextMine < this.mineWaves.length && t >= this.mineWaves[this.nextMine].time) {
      this.queueMines(this.mineWaves[this.nextMine++])
    }
    const seg = this.segs.find((s) => t >= s.from && t < s.to)
    if (!seg) { this.nextArrival = Math.max(this.nextArrival, t); return }
    // Poisson arrivals: exponential gaps between rocks, so there is no beat
    // to read and no rows.
    while (this.nextArrival <= t) {
      this.placeRock(seg, this.nextArrival + ROCK.preview)
      this.nextArrival += -Math.log(1 - Math.random()) / seg.rate
    }
    while (this.placed.length && this.placed[0].at < t - 1) this.placed.shift()
  }

  /** Dart-throwing placement: a random x, kept off the clear path for the
   *  rock's whole height and at least ROCK_SPACING from every other rock.
   *  A rock that finds no spot in a few tries is dropped. */
  private placeRock(seg: RockSegment, at: number) {
    const total = SIZES.reduce((n, s) => n + seg.sizes[s], 0)
    let pick = Math.random() * total
    const size = SIZES.find((s) => (pick -= seg.sizes[s]) < 0) ?? 'small'
    const r = (ROCK.sizes[size].dia * K) / 2
    const half = (seg.gap * K) / 2
    const span = r / ROCK_V   // entry-time extent of the rock's height
    for (let i = 0; i < TRIES; i++) {
      const x = rand(PLAYFIELD_LEFT + r * 0.3, PLAYFIELD_RIGHT - r * 0.3)
      if (Math.abs(x - this.pathAt(at - span)) < half + r ||
          Math.abs(x - this.pathAt(at)) < half + r ||
          Math.abs(x - this.pathAt(at + span)) < half + r) continue
      let clear = true
      for (const o of this.placed) {
        const dx = o.x - x, dy = (o.at - at) * ROCK_V, min = o.r + r + ROCK_SPACING
        if (dx * dx + dy * dy < min * min) { clear = false; break }
      }
      if (!clear) continue
      this.placed.push({ at, x, r })
      this.pending.push({ at, mine: false, x, size, preview: ROCK.preview })
      this.pending.sort((a, b) => a.at - b.at)
      return
    }
  }

  /** The clear path's center for a given entry time: random control
   *  points every PATH_STEP, each at most `wander`·PATH_STEP from the last,
   *  eased between (smoothstep), so it bends but never jumps. */
  private pathAt(at: number): number {
    const u = Math.max(0, at) / PATH_STEP
    const k = Math.floor(u), f = u - k
    while (this.path.length <= k + 1) {
      const n = this.path.length
      const seg = this.segs.find((s) => n * PATH_STEP >= s.from && n * PATH_STEP < s.to) ?? this.segs[0]
      const half = ((seg?.gap ?? 200) * K) / 2
      const lo = PLAYFIELD_LEFT + half + 8 * K, hi = PLAYFIELD_RIGHT - half - 8 * K
      const prev = n ? this.path[n - 1] : rand(lo, hi)
      const step = (seg?.wander ?? 50) * K * PATH_STEP
      this.path.push(Math.max(lo, Math.min(hi, prev + rand(-step, step))))
    }
    const a = this.path[k], b = this.path[k + 1]
    return a + (b - a) * f * f * (3 - 2 * f)
  }

  private queueMines(wave: MineWave) {
    const at = (fx: number, delay = 0) => this.pending.push({
      at: this.elapsed + MINE.preview + delay, mine: true,
      x: PLAYFIELD_LEFT + PLAYFIELD_W * Math.max(0.08, Math.min(0.92, fx)), size: 'small', preview: MINE.preview,
    })
    const x = wave.x
    switch (wave.pattern) {
      case 'single': at(x); break
      case 'pair': at(x - 0.17); at(x + 0.17); break
      case 'triangle': at(x); at(x - 0.2, 0.4); at(x + 0.2, 0.4); break
      case 'gate':
        // Mines across the field, leaving one opening around x that is wide
        // enough to pass with neither neighbour's trigger reaching in.
        for (let f = 0.1; f <= 0.9; f += 0.2) if (Math.abs(f - x) > 0.25) at(f)
        break
    }
    this.pending.sort((a, b) => a.at - b.at)
  }

  private spawn(p: Pending) {
    if (p.mine) {
      const m = this.mines.find((m) => !m.active)
      if (!m) return
      m.active = true; m.state = 'idle'; m.t = 0
      m.sprite.x = p.x; m.sprite.y = -MINE_R; m.sprite.tint = 0xffffff; m.sprite.visible = true
      m.sprite.rotation = rand(0, Math.PI * 2)
      return
    }
    const r = this.rocks.find((r) => !r.active)
    if (!r) return
    const tex = this.tex.get(p.size)!
    const d = ROCK.sizes[p.size].dia * K
    r.active = true
    r.r = d * ROCK.hitFrac
    r.spin = rand(-ROCK.maxSpin, ROCK.maxSpin)
    const s = r.sprite
    s.texture = tex
    s.scale.set(d / Math.max(tex.width, tex.height))
    if (Math.random() < 0.5) s.scale.x *= -1
    s.rotation = rand(0, Math.PI * 2)
    s.x = p.x; s.y = ROCK_Y0
    s.visible = true
  }

  private draw() {
    const g = this.g
    g.clear()
    // Entry markers on the top edge: amber for rocks, red for mines,
    // brightening as the hazard arrives.
    for (const p of this.pending) {
      const left = p.at - this.elapsed
      if (left > p.preview) break
      const k = 1 - left / p.preview
      const w = p.mine ? MINE.dia * K : ROCK.sizes[p.size].dia * K
      const color = p.mine ? 0xff4a3a : 0xffb347
      const blink = 0.55 + 0.45 * Math.abs(Math.sin(this.age * 12))
      g.rect(p.x - w / 2, 0, w, 4 * K).fill({ color, alpha: (0.35 + 0.5 * k) * blink })
      g.poly([p.x, 14 * K, p.x - 8 * K, 5 * K, p.x + 8 * K, 5 * K]).fill({ color, alpha: (0.4 + 0.6 * k) * blink })
    }
    for (const m of this.mines) {
      if (!m.active) continue
      const { x, y } = m.sprite
      if (m.state === 'idle') {
        // The trigger reach, faint, so it can be judged before it bites.
        g.circle(x, y, TRIGGER).stroke({ color: 0xff5a4a, width: 1, alpha: 0.18 })
      } else if (m.state === 'armed') {
        const p = Math.max(0, m.t) / MINE.fuse   // 1 → 0
        g.circle(x, y, BLAST).fill({ color: 0xff2a1a, alpha: 0.10 + 0.14 * (1 - p) })
        g.circle(x, y, BLAST).stroke({ color: 0xff5a4a, width: 2, alpha: 0.85 })
        g.circle(x, y, Math.max(2, BLAST * p)).stroke({ color: 0xffffff, width: 2.5, alpha: 0.9 })
      } else {
        const p = 1 - Math.max(0, m.t) / MINE.blastFx
        g.circle(x, y, BLAST * (0.7 + 0.4 * p)).stroke({ color: 0xffb070, width: 6 * (1 - p) + 1, alpha: 1 - p })
      }
    }
  }
}
