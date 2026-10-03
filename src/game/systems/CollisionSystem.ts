import { BulletPool } from '../entities/BulletPool'
import { Enemy } from '../entities/Enemy'
import { Player } from '../entities/Player'
import { AbsorbField } from '../fx/AbsorbField'
import { SPRITE_SCALE } from '../config'

const BULLET_R = 3 * SPRITE_SCALE

function overlaps(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

/**
 * Only the ship can be hurt, so each check is the ship against one list:
 * linear in the number of hostiles, no pairwise pass.
 */
export class CollisionSystem {
  /**
   * Absorb every energy round inside the field. The field is wider than the
   * ship's hit core, so an energy round always meets the field first:
   * energy rounds never do damage. Runs before check(): one round, one
   * outcome.
   */
  absorb(energy: BulletPool, player: Player, field: AbsorbField, onCatch: (x: number, y: number) => void) {
    if (player.isDead) return
    for (const b of energy.all) {
      if (!b.active || !field.contains(player.x, player.y, b.sprite.x, b.sprite.y)) continue
      const x = b.sprite.x, y = b.sprite.y
      energy.release(b)
      onCatch(x, y)
    }
  }

  /** Solid hazards against the ship's hit core: missiles, then rams.
   *  Player.hit() decides whether a contact costs hull. */
  check(missiles: BulletPool, enemies: Enemy[], player: Player): void {
    if (player.isDead) return
    const h = player.hitHalf
    const px = player.x - h, py = player.y - h, ps = h * 2

    for (const m of missiles.all) {
      if (!m.active) continue
      if (!overlaps(m.sprite.x - BULLET_R, m.sprite.y - BULLET_R, BULLET_R * 2, BULLET_R * 2, px, py, ps, ps)) continue
      if (player.hit('missile')) { missiles.release(m); return }
    }

    for (const e of enemies) {
      if (!e.harmful) continue
      if (!overlaps(px, py, ps, ps, e.sprite.x - e.halfW, e.sprite.y - e.halfH, e.halfW * 2, e.halfH * 2)) continue
      if (player.hit('ram')) return
    }
  }
}
