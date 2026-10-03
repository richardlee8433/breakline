import { Application, Container, Graphics } from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'
import { loadAssets } from '../../assets/AssetLoader'
import { InputSystem } from '../systems/InputSystem'
import { ScrollSystem } from '../systems/ScrollSystem'
import { CollisionSystem, KillFx } from '../systems/CollisionSystem'
import { WaveSystem } from '../systems/WaveSystem'
import { BulletPool } from '../entities/BulletPool'
import { Player } from '../entities/Player'
import { Boss } from '../entities/Boss'
import { PickupPool } from '../entities/Pickup'
import { ExplosionPool } from '../fx/Explosion'
import { BombEffect } from '../fx/BombEffect'
import { screenShake } from '../fx/ScreenShake'
import { hitstop } from '../fx/Hitstop'
import { BulletTrail } from '../fx/BulletTrail'
import { Shockwave } from '../fx/Shockwave'
import { makeGlowBulletTexture } from '../fx/GlowTexture'
import { GemPool } from '../entities/Gem'
import { musicSystem } from '../systems/MusicSystem'
import { EngineExhaust } from '../fx/EngineExhaust'
import { FloatingTextPool } from '../fx/FloatingText'
import { STAGES } from '../data/stages'
import { gameStore } from '../../store/gameStore'
import { audioSystem } from '../systems/AudioSystem'

import {
  STAGE_W as W, STAGE_H as H, SPRITE_SCALE,
  PLAYFIELD_W, PLAYFIELD_LEFT, PLAYFIELD_RIGHT,
} from '../config'

export class GameApp {
  private app: Application
  private input: InputSystem
  private collision: CollisionSystem

  private scroll!: ScrollSystem
  private waves!: WaveSystem
  private playerBullets!: BulletPool
  private enemyBullets!: BulletPool
  private bossBullets!: BulletPool
  private player!: Player
  private boss!: Boss
  private pickups!: PickupPool
  private gems!: GemPool
  private explosions!: ExplosionPool
  private bombEffect!: BombEffect
  private bulletTrail!: BulletTrail
  private exhaust!: EngineExhaust
  private shockwave!: Shockwave
  private floats!: FloatingTextPool
  private killFx!: KillFx

  private bgLayer!: Container
  private gameLayer!: Container
  private bulletLayer!: Container
  private fxLayer!: Container

  private transitioning = false
  private bossCountdown = -1   // >=0: WARNING banner is up, boss enters at 0
  private chainTimer = 0       // kill-chain lapse countdown
  private lastChain = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.app = new Application()
    this.input = new InputSystem()
    this.collision = new CollisionSystem()
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

    // Bullets and fx each get their own bloom pass rather than sharing one:
    // the bullet pass is clipped to the combat corridor, while the fx pass
    // must stay full-screen (bomb flash, shockwave sweep across everything).
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
    this.app.stage.addChild(
      this.bgLayer, edgeLayer, this.gameLayer, bulletWrap, fxWrap,
    )

    // Landscape only: gameplay lives in a central corridor, with the nebula
    // continuing into decorative side wings. Clip gameplay to the corridor so
    // ships flying in never appear out in the wings, and dim the wings so the
    // corridor reads as deliberate framing. Portrait needs neither (the
    // corridor is the whole stage), so it pays no cost at all.
    if (PLAYFIELD_W < W) {
      // One mask instance per container — Pixi tracks a mask's owner, so the
      // same Graphics cannot clip two containers.
      for (const target of [this.gameLayer, bulletWrap]) {
        const m = new Graphics().rect(PLAYFIELD_LEFT, 0, PLAYFIELD_W, H).fill(0xffffff)
        this.app.stage.addChild(m)
        target.mask = m
      }
      this.buildCorridorEdges(edgeLayer)
    }

    this.scroll = new ScrollSystem(this.bgLayer, W, H, 'space')

    // Neon glow bullets (danmaku-style): enemy fire must pop against the
    // dark background and read differently from the player's shots.
    const enemyBulletTex = makeGlowBulletTexture(this.app.renderer, 0xff2e88, 5 * SPRITE_SCALE)
    const bossBulletTex  = makeGlowBulletTexture(this.app.renderer, 0x33eeff, 6 * SPRITE_SCALE)

    this.bulletTrail   = new BulletTrail(this.bulletLayer)
    this.playerBullets = new BulletPool(this.bulletLayer, assets.playerBullet, 300)
    this.enemyBullets  = new BulletPool(this.bulletLayer, enemyBulletTex, 1000)
    this.bossBullets   = new BulletPool(this.bulletLayer, bossBulletTex,  200)

    this.player    = new Player(this.gameLayer, assets.playerShip, this.playerBullets, H)
    this.boss      = new Boss(this.gameLayer)
    this.pickups   = new PickupPool(this.gameLayer, assets.pickupOneUp)
    this.gems      = new GemPool(this.gameLayer, assets.gem)
    this.explosions = new ExplosionPool(this.fxLayer, assets.explosionFrames)
    this.bombEffect = new BombEffect(this.fxLayer, W, H)
    this.shockwave  = new Shockwave(this.fxLayer)
    this.floats     = new FloatingTextPool(this.fxLayer)
    this.killFx     = {
      explosions: this.explosions, floats: this.floats, pickups: this.pickups, gems: this.gems,
    }
    this.exhaust    = new EngineExhaust(
      this.bulletLayer, makeGlowBulletTexture(this.app.renderer, 0x44aaff, 3.5 * SPRITE_SCALE))

    this.waves = new WaveSystem(this.gameLayer)
    await this.waves.loadTextures()

    // Phase transitions
    gameStore.subscribe((s, prev) => {
      if (s.phase === 'playing' && prev.phase === 'title') {
        this.startStage(s.stage)   // startStage owns the per-stage BGM
      }
      if (s.phase === 'stageclear' && prev.phase !== 'stageclear') {
        this.handleStageClear(s.stage)
      }
      if (s.phase === 'gameover' && s.phase !== prev.phase) musicSystem.stop()
      if (s.phase === 'title' && s.phase !== prev.phase) musicSystem.playTitle()
    })

    // Catch-up: on slow networks (VIVERSE/Netlify CDN) the player can press
    // START before init reaches this line — that title→playing transition
    // happened with no subscriber, so no stage was ever loaded and no enemies
    // would spawn. If we're already mid-"playing", start the stage now.
    if (gameStore.getState().phase === 'playing') {
      this.startStage(gameStore.getState().stage)
    }

    this.app.ticker.add(({ deltaMS }) => {
      const dt = Math.min(deltaMS / 1000, 0.05)
      this.tick(dt)
    })
  }

  /**
   * Side wings: a stepped shade that deepens away from the corridor (a cheap
   * gradient without a texture) plus a faint rule on each corridor edge.
   */
  private buildCorridorEdges(layer: Container) {
    const g = new Graphics()
    const STEPS = 6
    const wing = PLAYFIELD_LEFT
    for (let i = 0; i < STEPS; i++) {
      const w = wing / STEPS
      const alpha = 0.10 + 0.32 * ((STEPS - 1 - i) / (STEPS - 1))  // darkest at the outer edge
      g.rect(i * w, 0, w, H).fill({ color: 0x00030a, alpha })
      g.rect(PLAYFIELD_RIGHT + wing - (i + 1) * w, 0, w, H).fill({ color: 0x00030a, alpha })
    }
    g.rect(PLAYFIELD_LEFT - 1, 0, 2, H).fill({ color: 0x3388bb, alpha: 0.30 })
    g.rect(PLAYFIELD_RIGHT - 1, 0, 2, H).fill({ color: 0x3388bb, alpha: 0.30 })
    layer.addChild(g)
  }

  private startStage(stageNum: number) {
    const cfg = STAGES[stageNum - 1] ?? STAGES[0]
    musicSystem.playStage(stageNum)
    this.scroll.setTheme(cfg.bgTheme)
    this.waves.loadStage(cfg)
    this.playerBullets.releaseAll()
    this.enemyBullets.releaseAll()
    this.bossBullets.releaseAll()
    this.pickups.releaseAll()
    this.gems.releaseAll()
    this.floats.releaseAll()
    this.player.reset()
    gameStore.getState().resetChain()
    this.chainTimer = 0
    this.lastChain = 0
    this.transitioning = false
    this.bossCountdown = -1
    gameStore.getState().setBossWarning(false)
  }

  private handleStageClear(_stageNum: number) {
    if (this.transitioning) return
    this.transitioning = true
    musicSystem.playJingle('stage-clear')

    // Advance to the next stage — advanceStage wraps past the last stage
    // into the next loop, where enemies come back faster and meaner.
    setTimeout(() => {
      gameStore.getState().advanceStage()   // phase → 'advancing'
    }, 2000)

    setTimeout(() => {
      const s = gameStore.getState()
      this.startStage(s.stage)
      gameStore.setState({ phase: 'playing' })
    }, 4500)
  }

  private tick(dt: number) {
    const state = gameStore.getState()
    if (state.paused) return   // freeze the whole scene while paused
    const phase = state.phase
    screenShake.update(dt, this.app.stage)
    this.scroll.update(dt)
    if (phase !== 'playing') return
    if (hitstop.update(dt)) return   // impact freeze-frame

    this.input.update()
    this.player.update(dt, this.input.actions)
    if (this.player.consumeJustDied()) this.onPlayerDeath()

    // Kill-chain lapse: each kill rearms the window; silence breaks the chain
    const chain = gameStore.getState().chain
    if (chain > this.lastChain) this.chainTimer = 2.0
    else if (chain > 0) {
      this.chainTimer -= dt
      if (this.chainTimer <= 0) gameStore.getState().resetChain()
    }
    this.lastChain = gameStore.getState().chain

    this.exhaust.update(dt, this.player.x, this.player.y, !this.player.isDead)
    this.bulletTrail.update(this.playerBullets)
    this.playerBullets.update(dt, W, H)
    this.enemyBullets.update(dt, W, H)
    this.bossBullets.update(dt, W, H)

    const { spawnBoss, activeLasers } = this.waves.update(dt, this.enemyBullets, this.player.x, this.player.y, H)
    if (spawnBoss && !this.boss.active && this.bossCountdown < 0) {
      // WARNING phase: clear the field, blare the siren, boss enters after it
      this.bossCountdown = 2.4
      gameStore.getState().setBossWarning(true)
      audioSystem.playSiren()
      // The boss theme's 2.1s intro runs under the 2.4s WARNING banner, so
      // its main loop drops exactly as the boss finishes entering.
      musicSystem.playBoss()
      this.waves.dismissAll()
      this.enemyBullets.releaseAll()
      // Warm the browser cache during the siren — boss art runs to a few
      // hundred KB, and spawn() fetches it at the instant it must appear.
      new Image().src = (STAGES[gameStore.getState().stage - 1] ?? STAGES[0]).boss.shipSprite
    }
    if (this.bossCountdown >= 0) {
      this.bossCountdown -= dt
      if (this.bossCountdown < 0 && !this.boss.active) {
        gameStore.getState().setBossWarning(false)
        const { stage, loop } = gameStore.getState()
        const cfg = STAGES[stage - 1] ?? STAGES[0]
        // Loop rank: later playthroughs field tougher, faster bosses
        const rank = Math.min(loop - 1, 4)
        const boss = rank === 0 ? cfg.boss : {
          ...cfg.boss,
          maxHp: Math.round(cfg.boss.maxHp * (1 + 0.25 * rank)),
          bulletSpeedMult: cfg.boss.bulletSpeedMult * (1 + 0.12 * rank),
          fireRateMult: cfg.boss.fireRateMult / (1 + 0.08 * rank),
        }
        this.boss.spawn(boss, stage)
      }
    }

    // Enemy laser hits on player (registers a hit; death resolves below)
    for (const beam of activeLasers) {
      if (this.player.y > beam.fromY && Math.abs(this.player.x - beam.x) < 10) {
        this.player.hit()
        break
      }
    }

    if (this.boss.active) {
      this.boss.update(
        dt, this.player.x, this.player.y,
        this.bossBullets, this.explosions, this.bombEffect,
      )
    }

    this.pickups.update(dt, this.player.x, this.player.y, H)
    this.gems.update(dt, this.player.x, this.player.y, H)

    this.collision.check(
      this.playerBullets, this.enemyBullets, this.bossBullets,
      this.waves.enemies,
      this.boss.active ? this.boss : null,
      this.player, this.killFx,
    )

    this.explosions.update(dt)
    this.bombEffect.update(dt)
    this.shockwave.update(dt)
    this.floats.update(dt)
  }

  private onPlayerDeath() {
    this.explosions.spawn(this.player.x, this.player.y, 2.5)
    screenShake.trigger(8)
    hitstop.trigger(0.15)
    audioSystem.playPlayerHit()
    const s = gameStore.getState()
    s.resetChain()   // death breaks the kill chain
    s.loseLife()
    if (s.lives <= 1) s.setPhase('gameover')
  }

  /** CSS scale of the canvas so touch deltas map to game pixels */
  setCanvasScale(s: number) {
    this.input.setCanvasScale(s)
  }

  destroy() {
    this.app.destroy()
    this.input.destroy()
  }
}
