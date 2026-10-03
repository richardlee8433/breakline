import { Application, Container, Graphics } from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'
import { loadAssets } from '../../assets/AssetLoader'
import { InputSystem } from '../systems/InputSystem'
import { ScrollSystem } from '../systems/ScrollSystem'
import { CollisionSystem, KillFx, damageEnemy, damageBoss, shootDownMissile } from '../systems/CollisionSystem'
import { WaveSystem } from '../systems/WaveSystem'
import { BulletPool } from '../entities/BulletPool'
import { Player } from '../entities/Player'
import { Boss } from '../entities/Boss'
import { HostilePools } from '../entities/Enemy'
import { PickupPool } from '../entities/Pickup'
import { ExplosionPool } from '../fx/Explosion'
import { BombEffect } from '../fx/BombEffect'
import { screenShake } from '../fx/ScreenShake'
import { hitstop } from '../fx/Hitstop'
import { BulletTrail } from '../fx/BulletTrail'
import { Shockwave } from '../fx/Shockwave'
import { makeGlowBulletTexture, makeEnergyBulletTexture, makeMissileTexture } from '../fx/GlowTexture'
import { AbsorbField } from '../fx/AbsorbField'
import { CoreSystem } from '../systems/CoreSystem'
import { COUNTER } from '../data/core'
import { GemPool } from '../entities/Gem'
import { musicSystem } from '../systems/MusicSystem'
import { EngineExhaust } from '../fx/EngineExhaust'
import { FloatingTextPool } from '../fx/FloatingText'
import { STORY_STAGES, stageConfig } from '../data/stages'
import { introFor } from '../data/story'
import { gameStore, HitCause, Hint } from '../../store/gameStore'
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
  private missiles!: BulletPool
  private hostilePools!: HostilePools
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
  private core = new CoreSystem()
  private absorbField!: AbsorbField
  private energyPools!: BulletPool[]
  // Held state of the press-to-trigger keys, for edge detection. Starts
  // "held" each stage so the key that started the run can't fire on frame 1.
  private held = { absorb: true, dash: true, counter: true }
  private coreSyncAcc = 0
  private lastCoreKey = ''

  // Playtest metrics not already tallied by CoreSystem.
  private run = {
    seconds: 0, overheatSeconds: 0, readyIdleSeconds: 0, dashes: 0, counterKills: 0,
    deaths: { energy: 0, missile: 0, hull: 0, beam: 0 } as Record<HitCause, number>,
    deathsWhileAbsorbing: 0,
  }
  // First-time teaching prompts. Non-blocking banners, once per run each.
  private hintSeen = { counter: false, missile: false, overheat: false }
  private hintTimer = 0
  private hintSerial = 0

  private bgLayer!: Container
  private gameLayer!: Container
  private bulletLayer!: Container
  private fxLayer!: Container

  private transitioning = false
  private clearTimer = 0       // stage-clear beat before the next briefing
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

    // Hostile fire comes in two kinds that must never be confused: cyan
    // hollow rings (energy, absorbable) and orange arrows (missiles, not).
    const energyTex = makeEnergyBulletTexture(this.app.renderer, 5 * SPRITE_SCALE)
    const bossEnergyTex = makeEnergyBulletTexture(this.app.renderer, 6 * SPRITE_SCALE)
    const missileTex = makeMissileTexture(this.app.renderer, SPRITE_SCALE)

    this.bulletTrail   = new BulletTrail(this.bulletLayer)
    this.playerBullets = new BulletPool(this.bulletLayer, assets.playerBullet, 300)
    this.enemyBullets  = new BulletPool(this.bulletLayer, energyTex, 1000)
    this.bossBullets   = new BulletPool(this.bulletLayer, bossEnergyTex, 200)
    this.missiles      = new BulletPool(this.bulletLayer, missileTex, 120, true)

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

    this.hostilePools = { energy: this.enemyBullets, missile: this.missiles }
    this.energyPools = [this.enemyBullets, this.bossBullets]
    this.absorbField = new AbsorbField(this.fxLayer, energyTex)
    this.waves = new WaveSystem(this.gameLayer)
    await this.waves.loadTextures()

    // Phase transitions
    gameStore.subscribe((s, prev) => {
      // A new run (arena START, or story mode opening on its briefing).
      if (prev.phase === 'title' && s.phase !== 'title') this.resetRunStats()
      // Every way into combat — START, a finished briefing, a story retry —
      // loads the stage. startStage owns the per-stage BGM.
      if (s.phase === 'playing' && prev.phase !== 'playing') this.startStage(s.stage)
      if (s.phase === 'story' && prev.phase !== 'story') this.enterStory()
      if (s.phase === 'stageclear' && prev.phase !== 'stageclear') this.handleStageClear()
      if (s.phase === 'complete' && prev.phase === 'story') this.finishRun(true)   // story ending
      if (s.phase === 'gameover' && s.phase !== prev.phase) musicSystem.stop()
      if (s.phase === 'complete' && s.phase !== prev.phase) musicSystem.playJingle('stage-clear')
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
    const { mode } = gameStore.getState()
    const cfg = stageConfig(mode, stageNum)
    musicSystem.playStage(cfg.id)
    this.scroll.setTheme(cfg.bgTheme)
    this.waves.loadStage(cfg)
    this.clearField()
    this.player.reset()
    this.core.reset()
    this.core.enabled = gameStore.getState().coreEnabled
    this.absorbField.clear()
    this.held.absorb = this.held.dash = this.held.counter = true
    this.syncCore(true)
    gameStore.getState().setReport(null)
    // Teaching prompts belong to the first stage (story) or the arena.
    if (mode === 'arena' || stageNum === 1) {
      if (this.core.enabled) this.showHint('CYAN RINGS ARE ENERGY  ·  PRESS SHIFT TO ABSORB THEM', 'info', 6)
      else this.showHint('CONTROL RUN  ·  CORE OFFLINE  ·  SHOOT, DODGE, SPACE TO DASH', 'info', 5)
    } else {
      gameStore.getState().setHint(null)
    }
    gameStore.getState().resetChain()
    this.chainTimer = 0
    this.lastChain = 0
    this.transitioning = false
    this.bossCountdown = -1
    gameStore.getState().setBossWarning(false)
  }

  /** Per-run playtest metrics; cumulative across a story's three stages. */
  private resetRunStats() {
    this.run = {
      seconds: 0, overheatSeconds: 0, readyIdleSeconds: 0, dashes: 0, counterKills: 0,
      deaths: { energy: 0, missile: 0, hull: 0, beam: 0 }, deathsWhileAbsorbing: 0,
    }
    this.core.resetTally()
    this.hintSeen = { counter: false, missile: false, overheat: false }
  }

  /** Release everything left on the field (between stages, and before a
   *  briefing so frozen debris doesn't sit behind the dialog). */
  private clearField() {
    this.playerBullets.releaseAll()
    this.enemyBullets.releaseAll()
    this.bossBullets.releaseAll()
    this.missiles.releaseAll()
    this.pickups.releaseAll()
    this.gems.releaseAll()
    this.floats.releaseAll()
    this.absorbField.clear()
    this.bulletTrail.update(this.playerBullets)   // redraw with no shots = clear the trails
  }

  /** A briefing (or the ending) is starting: tidy the field and show the
   *  upcoming stage's backdrop behind the dialog. */
  private enterStory() {
    const s = gameStore.getState()
    this.waves.dismissAll()
    this.clearField()
    this.player.reset()
    if (s.storyScene !== 'ending') this.scroll.setTheme(stageConfig(s.mode, s.stage).bgTheme)
    s.setHint(null)
  }

  private handleStageClear() {
    if (this.transitioning) return
    this.transitioning = true
    this.clearTimer = 2.5
    musicSystem.playJingle('stage-clear')
  }

  /** After the STAGE CLEAR beat: next stage's briefing, or the ending. */
  private afterStageClear() {
    const s = gameStore.getState()
    if (s.mode !== 'story') {
      this.finishRun(true)
      s.setPhase('complete')
      return
    }
    if (s.stage < STORY_STAGES.length) {
      gameStore.setState({ stage: s.stage + 1 })
      s.playScene(introFor(s.stage + 1))
    } else {
      s.playScene('ending')
    }
  }

  private tick(dt: number) {
    const state = gameStore.getState()
    if (state.paused) return   // freeze the whole scene while paused
    const phase = state.phase
    screenShake.update(dt, this.app.stage)
    this.scroll.update(dt)
    if (phase === 'stageclear' && this.clearTimer > 0) {
      this.clearTimer -= dt
      if (this.clearTimer <= 0) this.afterStageClear()
    }
    if (phase !== 'playing') return
    if (hitstop.update(dt)) return   // impact freeze-frame

    this.input.update()
    const a = this.input.actions
    const absorbPressed = a.absorb && !this.held.absorb
    const dashPressed = a.dash && !this.held.dash
    const counterPressed = a.counter && !this.held.counter
    this.held.absorb = a.absorb; this.held.dash = a.dash; this.held.counter = a.counter

    // A dash cancels an open absorb window; absorb can't open mid-dash.
    if (dashPressed && this.player.tryDash(a)) { this.core.cancelAbsorb(); this.run.dashes++ }
    if (absorbPressed && !this.player.isDead && !this.player.isDashing) this.core.startAbsorb()

    this.player.update(dt, a, this.core.absorbing)
    if (this.player.consumeJustDied()) this.onPlayerDeath()
    this.core.update(dt)
    if (counterPressed && !this.player.isDead && this.core.spendCounter()) this.fireCounter()
    this.trackRun(dt)

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
    this.missiles.update(dt, W, H)

    const { spawnBoss, activeLasers } = this.waves.update(
      dt, this.hostilePools, this.player.x, this.player.y, H)
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
      this.missiles.releaseAll()
      // Warm the browser cache during the siren — boss art runs to a few
      // hundred KB, and spawn() fetches it at the instant it must appear.
      const { mode, stage } = gameStore.getState()
      const sprite = stageConfig(mode, stage).boss?.shipSprite
      if (sprite) new Image().src = sprite
    }
    if (this.bossCountdown >= 0) {
      this.bossCountdown -= dt
      if (this.bossCountdown < 0 && !this.boss.active) {
        gameStore.getState().setBossWarning(false)
        const { stage, loop, mode } = gameStore.getState()
        const base = stageConfig(mode, stage).boss
        // Loop rank: later playthroughs field tougher, faster bosses
        const rank = Math.min(loop - 1, 4)
        if (base) {
          const boss = rank === 0 ? base : {
            ...base,
            maxHp: Math.round(base.maxHp * (1 + 0.25 * rank)),
            bulletSpeedMult: base.bulletSpeedMult * (1 + 0.12 * rank),
            fireRateMult: base.fireRateMult / (1 + 0.08 * rank),
          }
          this.boss.spawn(boss, stage)
        }
      }
    }

    // Enemy laser hits on player (registers a hit; death resolves below)
    for (const beam of activeLasers) {
      if (this.player.y > beam.fromY && Math.abs(this.player.x - beam.x) < 10) {
        this.player.hit('beam')
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

    this.absorbField.update(dt, this.player.x, this.player.y, this.core.absorbing && !this.player.isDead)
    if (this.core.absorbing) {
      this.collision.absorb(this.energyPools, this.player, (x, y) => {
        this.core.catchRound()
        this.absorbField.spawnCatch(x, y)
      })
    }
    this.collision.check(
      this.playerBullets, this.enemyBullets, this.bossBullets, this.missiles,
      this.waves.enemies,
      this.boss.active ? this.boss : null,
      this.player, this.killFx,
    )

    this.explosions.update(dt)
    this.bombEffect.update(dt)
    this.shockwave.update(dt)
    this.floats.update(dt)

    // Hull state at a glance: cyan while catching, a hot flicker when overheated.
    if (!this.player.isDead) {
      this.player.sprite.tint = this.core.overheated
        ? (Math.sin(performance.now() * 0.03) > 0 ? 0xff7a50 : 0xffc0a0)
        : this.core.absorbing ? 0xb8fbff : 0xffffff
    }
    this.syncCore(false, dt)

    // Boss-less stages (the Phase 1 arena) end once the field is clear.
    if (this.waves.finished && !this.player.isDead) {
      this.finishRun(true)
      gameStore.getState().setPhase('complete')
    }
  }

  /**
   * The counter is a screen-wide blast, the way neon-raiden's bomb was: a
   * shockwave from the ship, every hostile round erased (missiles knocked
   * down), every enemy on screen hit once, and a share of a boss's hull.
   */
  private fireCounter() {
    const x = this.player.x, y = this.player.y
    this.shockwave.trigger(x, y)
    screenShake.trigger(8)
    hitstop.trigger(0.08)
    audioSystem.playCounterFire()

    this.enemyBullets.releaseAll()
    this.bossBullets.releaseAll()
    for (const m of this.missiles.all) {
      if (m.active) shootDownMissile(this.missiles, m, this.killFx)
    }

    for (const e of this.waves.enemies) {
      // Only what the player can see: ships still queued above the screen
      // or outside the corridor are not caught by the blast.
      if (!e.active || e.sprite.y < 0 || e.sprite.y > H ||
          e.sprite.x < PLAYFIELD_LEFT || e.sprite.x > PLAYFIELD_RIGHT) continue
      if (damageEnemy(e, COUNTER.damage, this.killFx)) this.run.counterKills++
    }

    if (this.boss.active) {
      const dmg = Math.max(COUNTER.bossMinDamage, this.boss.maxHp * COUNTER.bossDamageFrac)
      damageBoss(this.boss, dmg, this.boss.sprite.x, this.boss.sprite.y, this.killFx, this.bossBullets)
      this.explosions.spawn(this.boss.sprite.x, this.boss.sprite.y, 3)
      audioSystem.playExplosion('large')
    }
  }

  /** Mirror the core into the store for the HUD: at most 20 Hz, and only
   *  when something visible changed — except catches and state flips, which
   *  push at once so the energy bar jumps on the frame it should. */
  private syncCore(force: boolean, dt = 0) {
    const c = this.core
    const view = {
      energy: Math.round(c.energy),
      heat: Math.round(c.heat),
      overheated: c.overheated,
      absorbing: c.absorbing,
      absorbCharge: Math.round(c.absorbCharge * 20) / 20,
      dashCharge: Math.round(this.player.dashCharge * 20) / 20,
      catchSerial: c.catchSerial,
    }
    const key = `${view.energy}|${view.heat}|${view.overheated}|${view.absorbing}|${view.absorbCharge}|${view.dashCharge}|${view.catchSerial}`
    if (key === this.lastCoreKey) return
    const prev = gameStore.getState().core
    const urgent = view.catchSerial !== prev.catchSerial || view.overheated !== prev.overheated ||
      view.absorbing !== prev.absorbing
    this.coreSyncAcc += dt
    if (!force && !urgent && this.coreSyncAcc < 0.05) return
    this.coreSyncAcc = 0
    this.lastCoreKey = key
    gameStore.getState().setCore(view)
  }

  private trackRun(dt: number) {
    const r = this.run, c = this.core
    r.seconds += dt
    if (c.overheated) r.overheatSeconds += dt
    if (c.counterReady && !this.player.isDead) r.readyIdleSeconds += dt

    if (this.hintTimer > 0) {
      this.hintTimer -= dt
      if (this.hintTimer <= 0) gameStore.getState().setHint(null)
    }
    if (c.enabled && !this.hintSeen.counter && c.energy >= COUNTER.cost) {
      this.hintSeen.counter = true
      this.showHint('CORE CHARGED  ·  PRESS E TO COUNTER', 'info', 4)
    }
    if (!this.hintSeen.missile && this.missiles.all.some((m) => m.active)) {
      this.hintSeen.missile = true
      this.showHint(c.enabled
        ? 'MISSILES CAN\'T BE ABSORBED  ·  SHOOT OR DODGE'
        : 'MISSILES  ·  SHOOT, DODGE OR DASH', 'warn', 5)
    }
    if (!this.hintSeen.overheat && c.overheated) {
      this.hintSeen.overheat = true
      this.showHint('OVERHEAT  ·  ABSORB LOCKED  ·  GUN AND DASH STILL WORK', 'warn', 4)
    }
  }

  private showHint(text: string, tone: Hint['tone'], seconds: number) {
    this.hintTimer = seconds
    gameStore.getState().setHint({ id: ++this.hintSerial, text, tone })
  }

  private finishRun(cleared: boolean) {
    const s = gameStore.getState()
    const r = this.run
    const round1 = (n: number) => Math.round(n * 10) / 10
    s.setHint(null)
    s.setReport({
      mode: this.core.enabled ? 'core' : 'control',
      cleared,
      seconds: round1(r.seconds),
      score: s.score,
      ...this.core.tally,
      counterKills: r.counterKills,
      overheatSeconds: round1(r.overheatSeconds),
      readyIdleSeconds: round1(r.readyIdleSeconds),
      dashes: r.dashes,
      deaths: { ...r.deaths },
      deathsWhileAbsorbing: r.deathsWhileAbsorbing,
    })
  }

  private onPlayerDeath() {
    this.run.deaths[this.player.lastHitCause]++
    if (this.core.absorbing) this.run.deathsWhileAbsorbing++
    this.core.cancelAbsorb()
    this.explosions.spawn(this.player.x, this.player.y, 2.5)
    screenShake.trigger(8)
    hitstop.trigger(0.15)
    audioSystem.playPlayerHit()
    const s = gameStore.getState()
    s.resetChain()   // death breaks the kill chain
    s.loseLife()
    if (s.lives <= 1) {
      this.finishRun(false)
      s.setPhase('gameover')
    }
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
