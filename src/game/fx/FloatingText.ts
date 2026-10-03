import { Container, Text } from 'pixi.js'

interface FloatInst {
  text: Text
  life: number
  active: boolean
}

const LIFE = 0.75
const RISE_SPEED = 55

/** Pooled short callouts ("SHAKEN OFF") that drift up and fade. */
export class FloatingTextPool {
  private pool: FloatInst[] = []

  constructor(container: Container, size = 24) {
    for (let i = 0; i < size; i++) {
      const text = new Text({
        text: '',
        style: {
          fontFamily: 'monospace',
          fontSize: 13,
          fontWeight: 'bold',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 3 },
        },
      })
      text.anchor.set(0.5)
      text.visible = false
      container.addChild(text)
      this.pool.push({ text, life: 0, active: false })
    }
  }

  spawn(x: number, y: number, str: string, color = 0xffffff) {
    const inst = this.pool.find((p) => !p.active)
    if (!inst) return
    inst.active = true
    inst.life = LIFE
    inst.text.text = str
    inst.text.style.fill = color
    inst.text.x = x
    inst.text.y = y
    inst.text.alpha = 1
    inst.text.visible = true
  }

  update(dt: number) {
    for (const inst of this.pool) {
      if (!inst.active) continue
      inst.life -= dt
      if (inst.life <= 0) {
        inst.active = false
        inst.text.visible = false
        continue
      }
      const t = inst.life / LIFE
      inst.text.y -= RISE_SPEED * (0.4 + 0.6 * t) * dt   // decelerating rise
      inst.text.alpha = t < 0.5 ? t * 2 : 1
    }
  }

  releaseAll() {
    for (const inst of this.pool) {
      inst.active = false
      inst.text.visible = false
    }
  }
}
