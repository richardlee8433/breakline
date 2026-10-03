import { Container, Sprite, Texture } from 'pixi.js'
import { gameStore } from '../../store/gameStore'
import { audioSystem } from '../systems/AudioSystem'
import { SPRITE_SCALE } from '../config'

export type PickupType = 'power' | 'oneup' | 'laser' | 'plasma'

interface PickupInstance {
  sprite: Sprite
  active: boolean
  type: PickupType
}

const FALL_SPEED = 80
const COLLECT_RADIUS = 28 * SPRITE_SCALE

export class PickupPool {
  private pool: PickupInstance[] = []

  constructor(
    private container: Container,
    private texPower: Texture,
    private texOneUp: Texture,
    private texLaser: Texture,
    private texPlasma: Texture,
    size = 20,
  ) {
    for (let i = 0; i < size; i++) {
      const sprite = new Sprite(texPower)
      sprite.anchor.set(0.5)
      // New pickup art uses a 48 px canvas rather than Kenney's 16 px tiles.
      // Keep the on-screen footprint readable without tripling its size.
      sprite.scale.set(0.8 * SPRITE_SCALE)
      sprite.visible = false
      container.addChild(sprite)
      this.pool.push({ sprite, active: false, type: 'power' })
    }
  }

  spawn(x: number, y: number, type: PickupType) {
    const inst = this.pool.find((p) => !p.active)
    if (!inst) return
    inst.active = true
    inst.type = type
    inst.sprite.texture = type === 'power' ? this.texPower
                        : type === 'oneup' ? this.texOneUp
                        : type === 'laser' ? this.texLaser
                        : this.texPlasma
    inst.sprite.x = x
    inst.sprite.y = y
    inst.sprite.alpha = 1
    inst.sprite.visible = true
  }

  update(dt: number, playerX: number, playerY: number, stageH: number) {
    for (const inst of this.pool) {
      if (!inst.active) continue
      inst.sprite.y += FALL_SPEED * dt
      inst.sprite.alpha = 0.7 + 0.3 * Math.sin(Date.now() / 200)

      const dx = inst.sprite.x - playerX
      const dy = inst.sprite.y - playerY
      if (dx * dx + dy * dy < COLLECT_RADIUS * COLLECT_RADIUS) {
        const s = gameStore.getState()
        if (inst.type === 'power')       s.addPower(1)
        else if (inst.type === 'oneup')  s.addLife()
        else if (inst.type === 'laser')  s.addLaserPower()
        else                             s.addPlasmaPower()
        audioSystem.playPickup(inst.type === 'oneup' ? 'life' : 'power')
        inst.active = false
        inst.sprite.visible = false
        continue
      }

      if (inst.sprite.y > stageH + 30) {
        inst.active = false
        inst.sprite.visible = false
      }
    }
  }

  releaseAll() {
    for (const inst of this.pool) {
      inst.active = false
      inst.sprite.visible = false
    }
  }
}
