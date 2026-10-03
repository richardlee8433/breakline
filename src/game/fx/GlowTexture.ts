import { Graphics, Renderer, Texture } from 'pixi.js'

/**
 * Round glowing bullet: white-hot core with layered halo in the given
 * neon color, so enemy fire reads clearly against the dark background.
 */
export function makeGlowBulletTexture(
  renderer: Renderer,
  color: number,
  radius: number,
): Texture {
  const g = new Graphics()
  g.circle(0, 0, radius * 2.4).fill({ color, alpha: 0.12 })
  g.circle(0, 0, radius * 1.7).fill({ color, alpha: 0.28 })
  g.circle(0, 0, radius * 1.2).fill({ color, alpha: 0.75 })
  g.circle(0, 0, radius * 0.65).fill(0xffffff)
  const tex = renderer.generateTexture({ target: g, antialias: true })
  g.destroy()
  return tex
}

/** Gold glowing diamond for score gems dropped by destroyed enemies. */
export function makeGemTexture(renderer: Renderer, radius = 7): Texture {
  const g = new Graphics()
  const color = 0xffc832
  g.circle(0, 0, radius * 1.9).fill({ color, alpha: 0.14 })
  g.circle(0, 0, radius * 1.3).fill({ color, alpha: 0.3 })
  g.poly([0, -radius, radius * 0.7, 0, 0, radius, -radius * 0.7, 0]).fill(color)
  g.poly([0, -radius * 0.45, radius * 0.32, 0, 0, radius * 0.45, -radius * 0.32, 0])
    .fill(0xfff8dc)
  const tex = renderer.generateTexture({ target: g, antialias: true })
  g.destroy()
  return tex
}

/**
 * Absorbable energy round: a cyan HOLLOW ring. Shape carries the meaning as
 * much as color does — a ring reads as "energy you can catch" even to a
 * colour-blind player, against the solid arrow of a missile.
 */
export function makeEnergyBulletTexture(renderer: Renderer, radius: number): Texture {
  const g = new Graphics()
  const color = 0x33eeff
  g.circle(0, 0, radius * 2.2).fill({ color, alpha: 0.10 })
  g.circle(0, 0, radius * 1.55).fill({ color, alpha: 0.20 })
  g.circle(0, 0, radius).stroke({ color, width: radius * 0.55, alpha: 0.95 })
  g.circle(0, 0, radius).stroke({ color: 0xffffff, width: radius * 0.2, alpha: 0.95 })
  g.circle(0, 0, radius * 0.22).fill({ color: 0xffffff, alpha: 0.55 })
  const tex = renderer.generateTexture({ target: g, antialias: true })
  g.destroy()
  return tex
}

/**
 * Non-absorbable missile, drawn pointing UP (the pool rotates it to its
 * velocity): solid orange-red body, arrowhead, fins and a yellow exhaust.
 * Nothing about it is round or hollow.
 */
export function makeMissileTexture(renderer: Renderer, scale: number): Texture {
  const g = new Graphics()
  const w = 5.5 * scale, h = 18 * scale
  g.ellipse(0, 0, w * 2.6, h * 1.1).fill({ color: 0xff3300, alpha: 0.16 })           // warning halo
  g.ellipse(0, h * 0.75, w * 1.1, h * 0.55).fill({ color: 0xffcc33, alpha: 0.30 })   // exhaust glow
  g.poly([-w * 0.6, h * 0.45, 0, h * 1.05, w * 0.6, h * 0.45]).fill(0xffee88)         // flame
  g.poly([-w * 1.6, h * 0.5, -w, h * 0.05, -w, h * 0.5]).fill(0xb8321a)               // fins
  g.poly([w * 1.6, h * 0.5, w, h * 0.05, w, h * 0.5]).fill(0xb8321a)
  g.rect(-w, -h * 0.45, w * 2, h * 0.95).fill(0xff4a1c)                               // body
  g.poly([-w, -h * 0.45, 0, -h, w, -h * 0.45]).fill(0xffffff)                         // warhead
  g.poly([-w * 0.55, -h * 0.5, 0, -h * 0.82, w * 0.55, -h * 0.5]).fill(0xff2a10)
  g.rect(-w, -h * 0.05, w * 2, h * 0.12).fill(0xffffff)                               // warning band
  const tex = renderer.generateTexture({ target: g, antialias: true })
  g.destroy()
  return tex
}

/** Counter-attack pulse: a tall capsule of white-hot core inside a cyan
 *  sheath — the caught energy, compressed and thrown back. */
export function makePulseTexture(renderer: Renderer, width: number, length: number): Texture {
  const g = new Graphics()
  const color = 0x33eeff
  g.roundRect(-width * 0.8, -length * 0.55, width * 1.6, length * 1.1, width * 0.8).fill({ color, alpha: 0.14 })
  g.roundRect(-width * 0.5, -length * 0.5, width, length, width * 0.5).fill({ color, alpha: 0.45 })
  g.roundRect(-width * 0.3, -length * 0.46, width * 0.6, length * 0.92, width * 0.3).fill({ color: 0x9ff8ff, alpha: 0.9 })
  g.roundRect(-width * 0.13, -length * 0.42, width * 0.26, length * 0.84, width * 0.13).fill(0xffffff)
  const tex = renderer.generateTexture({ target: g, antialias: true })
  g.destroy()
  return tex
}
