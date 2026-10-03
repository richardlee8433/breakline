import { Application, Container, Graphics } from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'
import { loadAssets } from '../../assets/AssetLoader'
import { InputSystem } from '../systems/InputSystem'
import { ScrollSystem } from '../systems/ScrollSystem'
import { CollisionSystem } from '../systems/CollisionSystem'
import { WaveSystem } from '../systems/WaveSystem'
import { HazardSystem } from '../systems/HazardSystem'
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
import { EMP, FIELD, HULL, JUMP, SCORE } from '../data/chase'
import { stageConfig, StageConfig } from '../data/stages'
import { gameStore, HitCause, Hint } from '../../store/gameStore'
import type { Speaker } from '../data/story'

const freshHits = (): Record<HitCause, number> => ({ missile: 0, ram: 0, rock: 0, mine: 0 })

import {
  STAGE_W as W, STAGE_H as H, SPRITE_SCALE,
  PLAYFIELD_W, PLAYFIELD_LEFT, PLAYFIELD_RIGHT,
} from '../config'

const IS_TOUCH = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)
const EMP_RADIUS = EMP.radiusFrac * PLAYFIELD_W

/** A short radio line, said once per run when its condition first holds.
 *  Urgent ones (threat warnings) cut in; the rest wait for a quiet moment. */
interface Cue {
  key: string
  who: Speaker | null
  text: string
  tone: Hint['tone']
  seconds: number
  urgent?: boolean
  when: () => boolean
}

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
  private hazards!: HazardSystem
  private energy!: BulletPool
  private missiles!: BulletPool
  private hostile!: HostilePools
  private player!: Player
  private explosions!: ExplosionPool
  private shockwave!: Shockwave
  private floats!: FloatingTextPool
  private exhaust!: EngineExhaust
  private field!: AbsorbField
  private jumpG = new Graphics()

  private bgLayer!: Container
  private gameLayer!: Container
  private bulletLayer!: Container
  private fxLayer!: Container

  // Per-stage state.
  private cfg!: StageConfig
  private elapsed = 0
  private duration = 1
  private deathTimer = 0       // > 0: the ship is gone; next life or game over follows
  private fatal: HitCause | null = null
  private jumpTimer = 0        // > 0: stage 3's synchronized jump is playing
  private finaleOn = false
  private empHeld = true       // edge detection: one press, one pulse
  private hudAcc = 0
  private lastCoreKey = ''
  private stats = { disabled: 0, shaken: 0, wrecked: 0, still: 0, hits: freshHits() }
  // Radio lines already used this run (each plays once).
  private said = new Set<string>()
  private hintTimer = 0
  private hintSerial = 0
  private cues: Cue[] = this.buildCues()

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
    // Terrain sits under every ship.
    const hazardLayer = new Container()
    this.gameLayer.addChildAt(hazardLayer, 0)
    this.hazards    = new HazardSystem(hazardLayer)
    this.fxLayer.addChild(this.jumpG)
    await Promise.all([this.waves.loadTextures(), this.hazards.load()])

    gameStore.subscribe((s, prev) => {
      if (prev.phase === 'title' && s.phase !== 'title') this.said.clear()
      // Every way into combat — a trial START, a finished briefing, a retry
      // (also from the pause menu, already in 'playing') — loads the stage
      // from scratch.
      if (s.phase === 'playing' && (prev.phase !== 'playing' || s.runSerial !== prev.runSerial)) {
        this.startStage(s.stage)
      }
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
    this.cfg = cfg
    musicSystem.playStage(cfg.id)
    this.scroll.setTheme(cfg.bgTheme)
    this.waves.loadStage(cfg)
    this.hazards.loadStage(cfg)
    this.clearField()
    this.player.reset()
    this.core.reset()
    this.elapsed = 0
    this.duration = cfg.duration
    this.deathTimer = 0
    this.fatal = null
    this.jumpTimer = 0
    this.finaleOn = false
    this.jumpG.clear()
    this.empHeld = true
    this.stats = { disabled: 0, shaken: 0, wrecked: 0, still: 0, hits: freshHits() }
    const s = gameStore.getState()
    s.markStageStart()
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
    this.hazards.clear()
    this.clearField()
    this.jumpTimer = 0
    this.jumpG.clear()
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

    // Stage 3 is won: the jump plays out, nothing can hurt the ship.
    if (this.jumpTimer > 0) { this.updateJump(dt); return }

    // The ship is gone: let the wreck burn for a beat (the clock waits),
    // then the next life — or game over after the last one.
    if (this.deathTimer > 0) {
      this.deathTimer -= dt
      this.energy.update(dt, W, H)
      this.missiles.update(dt, W, H)
      this.waves.update(dt, this.hostile, this.player.x, this.player.y)
      this.hazards.update(dt, this.player, this.explosions)
      this.hazards.steerPursuers(this.waves.enemies, dt, this.onWreck)
      if (this.deathTimer <= 0) {
        if (gameStore.getState().lives > 0) {
          this.player.respawn()
          gameStore.getState().setHull(this.player.hull)
        } else {
          this.finishStage(false)
          gameStore.getState().setPhase('gameover')
        }
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
    this.steerMissiles(dt)
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
    this.hazards.update(dt, this.player, this.explosions)
    this.stats.wrecked += this.hazards.steerPursuers(this.waves.enemies, dt, this.onWreck)
    if (this.player.lastHit) this.onHit(this.player.lastHit)

    this.field.update(dt, this.player.x, this.player.y, !this.player.isDead)
    if (this.cfg.finale && !this.finaleOn && this.duration - this.elapsed <= this.cfg.finale) {
      this.finaleOn = true
      musicSystem.playBoss()   // the last interception gets the boss theme
    }
    this.radioCues()
    this.syncHud(dt)

    // Story: the first mine on screen stops the chase once, so Rosa can
    // explain the fuse before anyone learns it the hard way.
    if (state.mode === 'story' && this.hazards.minesSeen && !this.said.has('tut-mine')) {
      this.said.add('tut-mine')
      gameStore.getState().setHint(null)
      gameStore.getState().playTalk('tut-mine')
    }
  }

  /** A pursuer hit a rock (usually drifting dark after an EMP). */
  private onWreck = (x: number, y: number) => {
    this.explosions.spawn(x, y, 1.8)
    audioSystem.playExplosion('small')
    this.floats.spawn(x, y - 20 * SPRITE_SCALE, 'WRECKED', 0xffb070)
  }

  /** Guided missiles turn toward the ship at a limited rate and burn out
   *  after GUIDED.life, so crossing their path always loses them. */
  private steerMissiles(dt: number) {
    const px = this.player.x, py = this.player.y
    for (const m of this.missiles.all) {
      if (!m.active || m.turn <= 0) continue
      m.life -= dt
      if (m.life <= 0) {
        this.explosions.spawn(m.sprite.x, m.sprite.y, 0.6)
        this.missiles.release(m)
        continue
      }
      const cur = Math.atan2(m.vy, m.vx)
      let diff = Math.atan2(py - m.sprite.y, px - m.sprite.x) - cur
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      const a = cur + Math.max(-m.turn * dt, Math.min(m.turn * dt, diff))
      const v = Math.sqrt(m.vx * m.vx + m.vy * m.vy)
      m.vx = Math.cos(a) * v; m.vy = Math.sin(a) * v
      m.sprite.rotation = a + Math.PI / 2
    }
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
      this.fatal = cause
      this.field.clear()
      gameStore.getState().loseLife()
      gameStore.getState().setHint(null)
      return
    }
    this.explosions.spawn(this.player.x, this.player.y, 1.1)
    screenShake.trigger(5)
    hitstop.trigger(0.06)
  }

  /** Time's up with the ship in one piece: the stage is cleared. On the
   *  jump stage the synchronized jump plays first. */
  private winStage() {
    this.elapsed = this.duration
    // Clear the pursuit: nothing can hurt the ship from here on.
    for (const m of this.missiles.all) if (m.active) this.explosions.spawn(m.sprite.x, m.sprite.y, 0.7)
    this.waves.dismissAll()
    this.hazards.clear()
    this.clearField()
    this.syncHud(0, true)
    this.finishStage(true)
    if (this.cfg.jump) {
      this.jumpTimer = JUMP.sequence
      musicSystem.playJingle('stage-clear')
      audioSystem.playEmp()
      return
    }
    gameStore.getState().setPhase('stageclear')
  }

  /**
   * The synchronized jump (design v0.2 §9): a ring of light closes around
   * the ship, the ship stretches and streaks forward, and the screen flashes
   * white. Then the ending (story) or the results (trial).
   */
  private updateJump(dt: number) {
    this.jumpTimer -= dt
    const p = Math.min(1, 1 - this.jumpTimer / JUMP.sequence)
    const s = this.player.sprite, g = this.jumpG
    const x = s.x, y = s.y
    g.clear()
    // 0–0.55: the jump field forms around the ship.
    const ring = Math.min(1, p / 0.35)
    const R = (150 - 60 * ring) * SPRITE_SCALE
    const spin = p * 14
    g.circle(x, y, R).stroke({ color: 0x9ff8ff, width: 3 + 5 * ring, alpha: 0.4 + 0.5 * ring })
    for (let i = 0; i < 8; i++) {
      const a = spin + (i * Math.PI) / 4
      g.moveTo(x + Math.cos(a) * R * 1.15, y + Math.sin(a) * R * 1.15)
        .lineTo(x + Math.cos(a) * R * 1.4, y + Math.sin(a) * R * 1.4)
    }
    g.stroke({ color: 0xffffff, width: 2, alpha: 0.7 * ring })
    // 0.55–0.85: stretch and streak up-screen.
    if (p > 0.55) {
      const q = Math.min(1, (p - 0.55) / 0.3)
      s.scale.y = this.player.baseScale * (1 + 1.6 * q)
      s.y -= (200 + 2400 * q * q) * SPRITE_SCALE * dt
      s.tint = 0xb8fbff
    }
    // 0.8–1: white-out.
    if (p > 0.8) {
      const f = Math.min(1, (p - 0.8) / 0.12) * (p > 0.92 ? Math.max(0, 1 - (p - 0.92) / 0.08) : 1)
      g.rect(0, 0, W, H).fill({ color: 0xffffff, alpha: f })
    }
    if (this.jumpTimer > 0) return
    g.clear()
    s.visible = false
    const st = gameStore.getState()
    if (st.mode === 'story') st.playScene('ending')
    else st.setPhase('stageclear')
  }

  private finishStage(cleared: boolean) {
    const s = gameStore.getState()
    const t = this.core.tally
    const round1 = (n: number) => Math.round(n * 10) / 10
    const integrity = Math.round((this.player.hull / HULL.max) * 100)
    const score = cleared ? integrity * SCORE.perIntegrityPct + s.lives * SCORE.perLife : 0
    if (cleared) s.setStageScore(s.stage, score)
    s.setHint(null)
    s.setReport({
      stage: s.stage,
      mode: s.mode,
      cleared,
      fatal: cleared ? null : this.fatal,
      score,
      integrity,
      livesLeft: s.lives,
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
      wrecked: this.stats.wrecked,
      stillPct: this.elapsed > 0 ? Math.round((this.stats.still / this.elapsed) * 100) : 0,
    })
  }

  /** Short radio lines, each once per run. They never stop the chase. */
  private radioCues() {
    for (const c of this.cues) {
      if (this.said.has(c.key) || !c.when()) continue
      if (this.hintTimer > 0 && !c.urgent) return   // wait for a quiet moment
      this.said.add(c.key)
      this.radio(c.who, c.text, c.tone, c.seconds)
      return
    }
  }

  /** Built once: the conditions read live state through `this`. Order is
   *  priority. Stage-specific keys carry the stage number. */
  private buildCues(): Cue[] {
    const active = (pred: (e: { def: { attack: string; hardened?: boolean }; state: string }) => boolean) =>
      this.waves.enemies.some((e) => e.active && e.state === 'chase' && pred(e))
    const left = () => this.duration - this.elapsed
    const stage = () => gameStore.getState().stage
    return [
      { key: 'lock', who: 'rosa', text: '飛彈鎖定！橘色的吸不掉，看到就閃。', tone: 'warn', seconds: 4, urgent: true,
        when: () => this.waves.enemies.some((e) => e.active && e.locking) },
      { key: 'guided', who: 'rosa', text: '粉紅色的飛彈會轉彎，但轉不快。橫向甩開它。', tone: 'warn', seconds: 4.5, urgent: true,
        when: () => active((e) => e.def.attack === 'guided') },
      { key: 'hardened', who: 'rosa', text: '紫色引擎的是抗干擾型，EMP 只能讓它停一下。', tone: 'warn', seconds: 4.5, urgent: true,
        when: () => active((e) => !!e.def.hardened) },
      { key: 'rocks', who: 'rosa', text: '上緣的橘色標記是岩塊落點，找空隙穿過去。', tone: 'info', seconds: 4, urgent: true,
        when: () => this.hazards.rocksSeen },
      { key: 'mines', who: 'rosa', text: '感應水雷：靠近就倒數一秒爆炸。看到紅圈就往外飛。', tone: 'warn', seconds: 5, urgent: true,
        when: () => this.hazards.minesSeen && gameStore.getState().mode === 'trial' },
      { key: 'ready', who: 'rosa', text: IS_TOUCH ? 'EMP 充滿了。追兵靠近時按 EMP。' : 'EMP 充滿了。追兵靠近時按 E 或 Space。',
        tone: 'info', seconds: 4, when: () => this.core.empReady },
      { key: 'shaken', who: 'kai', text: '甩掉一架。', tone: 'info', seconds: 2.5, when: () => this.stats.shaken > 0 },
      { key: 'wrecked', who: 'rosa', text: '熄火的追兵閃不開岩塊，撞毀了。', tone: 'info', seconds: 4,
        when: () => this.stats.wrecked > 0 },
      { key: 'jump-half', who: 'mira', text: '跳躍充能過半了，再撐兩分鐘。', tone: 'info', seconds: 3.5,
        when: () => !!this.cfg.jump && this.elapsed >= this.duration / 2 },
      { key: 'finale', who: 'thorne', text: '全隊，最後攔截。不准讓他們跳走。', tone: 'warn', seconds: 4, urgent: true,
        when: () => !!this.cfg.finale && left() <= this.cfg.finale },
      { key: 'last30-1', who: 'mira', text: '入口就在前面，還有三十秒！', tone: 'info', seconds: 3,
        when: () => stage() === 1 && left() <= 30 && this.duration > 45 },
      { key: 'last30-2', who: 'mira', text: '出口快到了，還有三十秒！', tone: 'info', seconds: 3,
        when: () => stage() === 2 && left() <= 30 && this.duration > 45 },
    ]
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
