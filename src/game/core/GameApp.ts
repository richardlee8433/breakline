import { Application, Container, Graphics } from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'
import { loadAssets } from '../../assets/AssetLoader'
import { InputSystem } from '../systems/InputSystem'
import { ScrollSystem } from '../systems/ScrollSystem'
import { CollisionSystem } from '../systems/CollisionSystem'
import { WaveSystem } from '../systems/WaveSystem'
import { CoreSystem } from '../systems/CoreSystem'
import { BulletPool } from '../entities/BulletPool'
import { Player } from '../entities/Player'
import { HostilePools } from '../entities/Enemy'
import { ExplosionPool } from '../fx/Explosion'
import { screenShake } from '../fx/ScreenShake'
import { hitstop } from '../fx/Hitstop'
import { Shockwave } from '../fx/Shockwave'
import { makeGlowBulletTexture, makeEnergyBulletTexture, makeMissileTexture } from '../fx/GlowTexture'
import { AbsorbField } from '../fx/AbsorbField'
import { EngineExhaust } from '../fx/EngineExhaust'
import { FloatingTextPool } from '../fx/FloatingText'
import { musicSystem } from '../systems/MusicSystem'
import { audioSystem } from '../systems/AudioSystem'
import { EMP, FIELD, HULL } from '../data/chase'
import { stageConfig } from '../data/stages'
import { gameStore, HitCause, Hint } from '../../store/gameStore'
import type { Speaker } from '../data/story'

import {
  STAGE_W as W, STAGE_H as H, SPRITE_SCALE,
  PLAYFIELD_W, PLAYFIELD_LEFT, PLAYFIELD_RIGHT,
} from '../config'

const IS_TOUCH = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)
const EMP_RADIUS = EMP.radiusFrac * PLAYFIELD_W

/**
 * The chase: survive the stage's clock while pursuers close in from behind.
 * Energy rounds feed the always-on field; the EMP spends a full gauge to
 * knock nearby pursuers dark; missiles and rams cost hull.
 */
export class GameApp {
  private app: Application
  private input: InputSystem
  private collision = new CollisionSystem()
  private core = new CoreSystem()

  private scroll!: ScrollSystem
  private waves!: WaveSystem
  private energy!: BulletPool
  private missiles!: BulletPool
  private hostile!: HostilePools
  private player!: Player
  private explosions!: ExplosionPool
  private shockwave!: Shockwave
  private floats!: FloatingTextPool
  private exhaust!: EngineExhaust
  private field!: AbsorbField

  private bgLayer!: Container
  private gameLayer!: Container
  private bulletLayer!: Container
  private fxLayer!: Container

  // Per-stage state.
  private elapsed = 0
  private duration = 1
  private deathTimer = 0       // > 0: the ship is gone, game over follows
  private empHeld = true       // edge detection: one press, one pulse
  private hudAcc = 0
  private lastCoreKey = ''
  private stats = { disabled: 0, shaken: 0, still: 0, hits: { missile: 0, ram: 0 } as Record<HitCause, number> }
  // Radio lines already used this run (each plays once).
  private said = new Set<string>()
  private hintTimer = 0
  private hintSerial = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.app = new Application()
    this.input = new InputSystem()
  }

  async init() {
    await this.app.init({
      canvas: this.canvas,
      width: W, height: H,
      background: 0x000011,
      antialias: false,
      resizeTo: undefined,
    })

    // Fire-and-forget: pulls the SFX bytes while the textures load, so they
    // are ready to decode the instant the first AudioContext exists.
    audioSystem.preload().catch((e) => console.error('[audio]', e))

    const assets = await loadAssets()
    console.log('[GameApp] assets loaded')

    this.bgLayer     = new Container()
    this.gameLayer   = new Container()
    this.bulletLayer = new Container()
    this.fxLayer     = new Container()

    // Bullets and fx each get their own bloom pass: the bullet pass is
    // clipped to the combat corridor, the fx pass stays full-screen.
    const bloom = () => new AdvancedBloomFilter({
      threshold: 0.25, bloomScale: 1.1, brightness: 1, blur: 5, quality: 4,
    })
    const bulletWrap = new Container()
    bulletWrap.addChild(this.bulletLayer)
    bulletWrap.filters = [bloom()]
    const fxWrap = new Container()
    fxWrap.addChild(this.fxLayer)
    fxWrap.filters = [bloom()]

    const edgeLayer = new Container()
    this.app.stage.addChild(this.bgLayer, edgeLayer, this.gameLayer, bulletWrap, fxWrap)

    // Landscape only: gameplay lives in a central corridor, with the nebula
    // continuing into dimmed side wings. Clip gameplay to the corridor.
    if (PLAYFIELD_W < W) {
      // One mask instance per container — Pixi tracks a mask's owner.
      for (const target of [this.gameLayer, bulletWrap]) {
        const m = new Graphics().rect(PLAYFIELD_LEFT, 0, PLAYFIELD_W, H).fill(0xffffff)
        this.app.stage.addChild(m)
        target.mask = m
      }
      this.buildCorridorEdges(edgeLayer)
    }

    this.scroll = new ScrollSystem(this.bgLayer, W, H, 'space')

    // Two kinds of hostile fire that must never be confused: cyan hollow
    // rings (energy, harmless, absorbed) and orange arrows (missiles, solid).
    const energyTex = makeEnergyBulletTexture(this.app.renderer, 5 * SPRITE_SCALE)
    const missileTex = makeMissileTexture(this.app.renderer, SPRITE_SCALE)
    this.energy   = new BulletPool(this.bulletLayer, energyTex, 500)
    this.missiles = new BulletPool(this.bulletLayer, missileTex, 120, true)
    this.hostile  = { energy: this.energy, missile: this.missiles }

    this.field      = new AbsorbField(this.fxLayer, energyTex)
    this.exhaust    = new EngineExhaust(
      this.bulletLayer, makeGlowBulletTexture(this.app.renderer, 0x44aaff, 3.5 * SPRITE_SCALE))
    this.player     = new Player(this.gameLayer, assets.playerShip, H)
    this.field.radius = this.player.shipWidth * FIELD.radiusFactor
    this.explosions = new ExplosionPool(this.fxLayer, assets.explosionFrames)
    this.shockwave  = new Shockwave(this.fxLayer)
    this.floats     = new FloatingTextPool(this.fxLayer)
    this.waves      = new WaveSystem(this.gameLayer)
    await this.waves.loadTextures()

    gameStore.subscribe((s, prev) => {
      if (prev.phase === 'title' && s.phase !== 'title') this.said.clear()
      // Every way into combat — a trial START, a finished briefing, a retry
      // — loads the stage from scratch.
      if (s.phase === 'playing' && prev.phase !== 'playing') this.startStage(s.stage)
      if (s.phase === 'story' && prev.phase !== 'story') this.enterStory()
      // A conversation just closed: the key that closed it must not also
      // fire the EMP on the first resumed frame.
      if (prev.talk && !s.talk) this.empHeld = true
      if (s.phase !== prev.phase) {
        if (s.phase === 'gameover') musicSystem.stop()
        if (s.phase === 'stageclear' || s.phase === 'complete') musicSystem.playJingle('stage-clear')
        if (s.phase === 'title') musicSystem.playTitle()
      }
    })

    // Switching tabs pauses the chase: the clock can't be run down unseen.
    document.addEventListener('visibilitychange', this.onVisibility)

    // Catch-up: START can be pressed before init gets here, with no
    // subscriber to see it. Load the stage now if so.
    if (gameStore.getState().phase === 'playing') this.startStage(gameStore.getState().stage)

    this.app.ticker.add(({ deltaMS }) => {
      this.tick(Math.min(deltaMS / 1000, 0.05))
    })
  }

  private onVisibility = () => {
    if (document.hidden) gameStore.getState().autoPause()
  }

  /** Side wings: a stepped shade deepening away from the corridor plus a
   *  faint rule on each corridor edge. */
  private buildCorridorEdges(layer: Container) {
    const g = new Graphics()
    const STEPS = 6
    const wing = PLAYFIELD_LEFT
    for (let i = 0; i < STEPS; i++) {
      const w = wing / STEPS
      const alpha = 0.10 + 0.32 * ((STEPS - 1 - i) / (STEPS - 1))
      g.rect(i * w, 0, w, H).fill({ color: 0x00030a, alpha })
      g.rect(PLAYFIELD_RIGHT + wing - (i + 1) * w, 0, w, H).fill({ color: 0x00030a, alpha })
    }
    g.rect(PLAYFIELD_LEFT - 1, 0, 2, H).fill({ color: 0x3388bb, alpha: 0.30 })
    g.rect(PLAYFIELD_RIGHT - 1, 0, 2, H).fill({ color: 0x3388bb, alpha: 0.30 })
    layer.addChild(g)
  }

  /** Fresh stage: full hull, empty gauge, clock at zero, timeline rewound. */
  private startStage(stageNum: number) {
    const cfg = stageConfig(stageNum)
    musicSystem.playStage(cfg.id)
    this.scroll.setTheme(cfg.bgTheme)
    this.waves.loadStage(cfg)
    this.clearField()
    this.player.reset()
    this.core.reset()
    this.elapsed = 0
    this.duration = cfg.duration
    this.deathTimer = 0
    this.empHeld = true
    this.stats = { disabled: 0, shaken: 0, still: 0, hits: { missile: 0, ram: 0 } }
    const s = gameStore.getState()
    s.setReport(null)
    s.setHull(this.player.hull)
    s.setClock(Math.ceil(this.duration), this.duration)
    this.syncCore(true)
    s.setHint(null)
    this.hintTimer = 0
    if (s.mode === 'trial') {
      this.radio(null, IS_TOUCH
        ? 'CYAN = ENERGY, AUTO-ABSORBED  ·  ORANGE = DODGE  ·  TAP EMP WHEN FULL'
        : 'CYAN = ENERGY, AUTO-ABSORBED  ·  ORANGE = DODGE  ·  E / SPACE = EMP', 'info', 6)
    }
  }

  /** Release everything left on the field. */
  private clearField() {
    this.energy.releaseAll()
    this.missiles.releaseAll()
    this.floats.releaseAll()
    this.field.clear()
  }

  /** A briefing (or the ending) is starting: tidy the field and show the
   *  upcoming stage's backdrop behind the dialog. */
  private enterStory() {
    const s = gameStore.getState()
    this.waves.dismissAll()
    this.clearField()
    this.player.reset()
    if (s.storyScene !== 'ending') this.scroll.setTheme(stageConfig(s.stage).bgTheme)
    s.setHint(null)
  }

  private tick(dt: number) {
    const state = gameStore.getState()
    if (state.paused) return
    screenShake.update(dt, this.app.stage)
    this.scroll.update(dt)
    this.shockwave.update(dt)
    this.explosions.update(dt)
    this.floats.update(dt)
    // A conversation pauses the chase (the backdrop keeps drifting).
    if (state.phase !== 'playing' || state.talk) return
    if (hitstop.update(dt)) return

    // The ship is gone: let the wreck burn for a beat, then game over.
    if (this.deathTimer > 0) {
      this.deathTimer -= dt
      this.energy.update(dt, W, H)
      this.missiles.update(dt, W, H)
      this.waves.update(dt, this.hostile, this.player.x, this.player.y)
      if (this.deathTimer <= 0) {
        this.finishStage(false)
        gameStore.getState().setPhase('gameover')
      }
      return
    }

    // The clock runs only while the chase does (never under dialog, pause,
    // or a hidden tab). Reaching the end beats a hit on the same frame.
    this.elapsed += dt
    if (this.elapsed >= this.duration) { this.winStage(); return }

    this.input.update()
    const a = this.input.actions
    const empPressed = a.emp && !this.empHeld
    this.empHeld = a.emp

    this.player.update(dt, a)
    if (this.player.moved < 0.5) this.stats.still += dt
    this.core.update(dt)
    if (empPressed && this.core.fireEmp()) this.fireEmp()

    this.exhaust.update(dt, this.player.x, this.player.y, true)
    this.energy.update(dt, W, H)
    this.missiles.update(dt, W, H)
    const shaken = this.waves.update(dt, this.hostile, this.player.x, this.player.y)
    if (shaken) {
      this.stats.shaken += shaken
      this.floats.spawn(this.player.x, H - 40 * SPRITE_SCALE, 'SHAKEN OFF', 0x9fdcff)
    }

    this.collision.absorb(this.energy, this.player, this.field, (x, y) => {
      this.core.absorb()
      this.field.spawnCatch(x, y)
    })
    this.collision.check(this.missiles, this.waves.enemies, this.player)
    if (this.player.lastHit) this.onHit(this.player.lastHit)

    this.field.update(dt, this.player.x, this.player.y, !this.player.isDead)
    this.radioCues()
    this.syncHud(dt)
  }

  /** The EMP: everything running inside its reach goes dark, and the
   *  missiles and rounds inside it are wiped. Nothing beyond it changes. */
  private fireEmp() {
    const x = this.player.x, y = this.player.y, r2 = EMP_RADIUS * EMP_RADIUS
    this.shockwave.trigger(x, y, EMP_RADIUS)
    screenShake.trigger(5)
    audioSystem.playEmp()
    for (const e of this.waves.enemies) {
      if (!e.empable) continue
      const dx = e.sprite.x - x, dy = e.sprite.y - y
      if (dx * dx + dy * dy > r2) continue
      e.disable(e.def.hardened ? EMP.disableHardened : EMP.disable)
      this.stats.disabled++
    }
    for (const pool of [this.energy, this.missiles]) {
      for (const b of pool.all) {
        if (!b.active) continue
        const dx = b.sprite.x - x, dy = b.sprite.y - y
        if (dx * dx + dy * dy > r2) continue
        if (pool === this.missiles) this.explosions.spawn(b.sprite.x, b.sprite.y, 0.7)
        pool.release(b)
      }
    }
    this.syncCore(true)
  }

  private onHit(cause: HitCause) {
    this.player.lastHit = null
    this.stats.hits[cause]++
    gameStore.getState().setHull(this.player.hull)
    audioSystem.playPlayerHit()
    if (this.player.isDead) {
      this.explosions.spawn(this.player.x, this.player.y, 2.5)
      screenShake.trigger(9)
      hitstop.trigger(0.15)
      this.deathTimer = HULL.deathBeat
      this.field.clear()
      gameStore.getState().setHint(null)
      return
    }
    this.explosions.spawn(this.player.x, this.player.y, 1.1)
    screenShake.trigger(5)
    hitstop.trigger(0.06)
  }

  /** Time's up with the ship in one piece: the stage is cleared. */
  private winStage() {
    this.elapsed = this.duration
    // Clear the pursuit: nothing can hurt the ship from here on.
    for (const m of this.missiles.all) if (m.active) this.explosions.spawn(m.sprite.x, m.sprite.y, 0.7)
    this.waves.dismissAll()
    this.clearField()
    this.syncHud(0, true)
    this.finishStage(true)
    gameStore.getState().setPhase('stageclear')
  }

  private finishStage(cleared: boolean) {
    const s = gameStore.getState()
    const t = this.core.tally
    const round1 = (n: number) => Math.round(n * 10) / 10
    s.setHint(null)
    s.setReport({
      stage: s.stage,
      mode: s.mode,
      cleared,
      seconds: round1(this.elapsed),
      duration: round1(this.duration),
      hullLeft: this.player.hull,
      hits: { ...this.stats.hits },
      rounds: t.rounds,
      banked: Math.round(t.banked),
      wasted: Math.round(t.wasted),
      emps: t.emps,
      disabled: this.stats.disabled,
      shaken: this.stats.shaken,
      stillPct: this.elapsed > 0 ? Math.round((this.stats.still / this.elapsed) * 100) : 0,
    })
  }

  /** Short radio lines, each once per run. They never stop the chase. */
  private radioCues() {
    const left = this.duration - this.elapsed
    if (!this.said.has('lock') && this.waves.enemies.some((e) => e.active && e.locking)) {
      this.say('lock', 'rosa', '飛彈鎖定！橘色的吸不掉，看到就閃。', 'warn', 4)
    } else if (!this.said.has('ready') && this.core.empReady) {
      this.say('ready', 'rosa', IS_TOUCH ? 'EMP 充滿了。追兵靠近時按 EMP。' : 'EMP 充滿了。追兵靠近時按 E 或 Space。', 'info', 4)
    } else if (!this.said.has('shaken') && this.stats.shaken > 0) {
      this.say('shaken', 'kai', '甩掉一架。', 'info', 2.5)
    } else if (!this.said.has(`last30-${gameStore.getState().stage}`) && left <= 30 && this.duration > 45) {
      this.say(`last30-${gameStore.getState().stage}`, 'mira', '還有三十秒，撐住！', 'info', 3)
    }
  }

  private say(key: string, who: Speaker, text: string, tone: Hint['tone'], seconds: number) {
    this.said.add(key)
    this.radio(who, text, tone, seconds)
  }

  private radio(who: Speaker | null, text: string, tone: Hint['tone'], seconds: number) {
    this.hintTimer = seconds
    gameStore.getState().setHint({ id: ++this.hintSerial, text, tone, ...(who ? { who } : {}) })
  }

  /** Mirror the clock, hull and core into the store for the HUD: at most
   *  20 Hz, and only when something visible changed (absorbs and the ready
   *  flip push at once, so the gauge moves on the frame it should). */
  private syncHud(dt: number, force = false) {
    const s = gameStore.getState()
    s.setClock(Math.max(0, Math.ceil(this.duration - this.elapsed)), this.duration)
    if (this.hintTimer > 0) {
      this.hintTimer -= dt
      if (this.hintTimer <= 0 && s.hint) s.setHint(null)
    }
    this.hudAcc += dt
    this.syncCore(force)
  }

  private syncCore(force: boolean) {
    const c = this.core
    const view = {
      energy: Math.round(c.energy),
      ready: c.empReady,
      empCharge: Math.round(c.empCharge * 20) / 20,
      catchSerial: c.catchSerial,
    }
    const key = `${view.energy}|${view.ready}|${view.empCharge}|${view.catchSerial}`
    if (key === this.lastCoreKey) return
    const prev = gameStore.getState().core
    const urgent = view.catchSerial !== prev.catchSerial || view.ready !== prev.ready
    if (!force && !urgent && this.hudAcc < 0.05) return
    this.hudAcc = 0
    this.lastCoreKey = key
    gameStore.getState().setCore(view)
  }

  /** CSS scale of the canvas so touch deltas map to game pixels */
  setCanvasScale(s: number) {
    this.input.setCanvasScale(s)
  }

  destroy() {
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.app.destroy()
    this.input.destroy()
  }
}
