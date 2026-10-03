import { BulletPool } from '../entities/BulletPool'
import { Enemy } from '../entities/Enemy'
import { Player } from '../entities/Player'
import { Boss } from '../entities/Boss'
import { PickupPool } from '../entities/Pickup'
import { GemPool } from '../entities/Gem'
import { ExplosionPool } from '../fx/Explosion'
import { FloatingTextPool, multColor } from '../fx/FloatingText'
import { gameStore } from '../../store/gameStore'
import { audioSystem } from './AudioSystem'
import { screenShake } from '../fx/ScreenShake'
import { hitstop } from '../fx/Hitstop'
import { SPRITE_SCALE } from '../config'
import { spawnEnemyDrop } from './DropSystem'

const GRAZE_RADIUS = 22 * SPRITE_SCALE
const BULLET_R = 3 * SPRITE_SCALE

/** Everything a kill needs to pay out, shared by every damage source. */
export interface KillFx {
  explosions: ExplosionPool
  floats: FloatingTextPool
  pickups: PickupPool
  gems: GemPool
}

function overlaps(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

/** Apply damage to an enemy; on a kill, run the full payout and deactivate it.
 *  Returns true if the enemy died. */
export function damageEnemy(enemy: Enemy, damage: number, fx: KillFx): boolean {
  enemy.hp -= damage
  if (enemy.hp > 0) { enemy.flash(); return false }
  const x = enemy.sprite.x, y = enemy.sprite.y
  fx.explosions.spawn(x, y, 2); screenShake.trigger(1.5); hitstop.trigger(0.025); audioSystem.playExplosion('small')
  const { awarded, mult } = gameStore.getState().addKillScore(enemy.scoreValue)
  fx.floats.spawn(x, y - 10, `+${awarded}`, multColor(mult))
  spawnEnemyDrop(fx.pickups, x, y)
  fx.gems.spawn(x, y, Math.random() < 0.35 ? 2 : 1)
  enemy.deactivate()
  return true
}

/** Damage the boss at an impact point, handling its death payout. */
export function damageBoss(boss: Boss, damage: number, impactX: number, impactY: number, fx: KillFx, bossBullets: BulletPool): boolean {
  const died = boss.hit(damage, impactX, impactY)
  screenShake.trigger(died ? 5 : 3); audioSystem.playBossHurt()
  if (died) {
    fx.explosions.spawn(boss.sprite.x, boss.sprite.y, 2.5); hitstop.trigger(0.12)
    bossBullets.releaseAll(); fx.gems.spawn(boss.sprite.x, boss.sprite.y, 16); fx.gems.magnetizeAll()
  }
  return died
}

export class CollisionSystem {
  check(
    playerBullets: BulletPool, enemyBullets: BulletPool, bossBullets: BulletPool,
    enemies: Enemy[], boss: Boss | null, player: Player, fx: KillFx,
  ) {
    const bossBox = boss?.active ? boss.hitboxWorld : null

    // ── player shots → enemies / boss ───────────────────────────────────
    for (const bullet of playerBullets.all) {
      if (!bullet.active) continue
      const bx = bullet.sprite.x - BULLET_R, by = bullet.sprite.y - BULLET_R * 2
      const bw = BULLET_R * 2, bh = BULLET_R * 4

      for (const enemy of enemies) {
        if (!enemy.active) continue
        const h = enemy.hitbox
        if (!overlaps(bx, by, bw, bh, enemy.sprite.x + h.x, enemy.sprite.y + h.y, h.width, h.height)) continue
        playerBullets.release(bullet)
        damageEnemy(enemy, bullet.damage, fx)
        break
      }

      if (bullet.active && bossBox && boss &&
          overlaps(bx, by, bw, bh, bossBox.x, bossBox.y, bossBox.width, bossBox.height)) {
        playerBullets.release(bullet)
        damageBoss(boss, bullet.damage, bullet.sprite.x, bullet.sprite.y, fx, bossBullets)
      }
    }

    if (player.isDead) return
    const ph = player.hitbox
    const px = player.x + ph.x, py = player.y + ph.y

    // ── enemy hulls → player ───────────────────────────────────────────
    for (const enemy of enemies) {
      if (!enemy.active) continue
      const h = enemy.hitbox
      if (overlaps(px, py, ph.width, ph.height, enemy.sprite.x + h.x, enemy.sprite.y + h.y, h.width, h.height)) {
        player.hit()
        return
      }
    }

    // ── hostile bullets → player (hit, else graze) ──────────────────────
    const g = GRAZE_RADIUS
    for (const pool of [enemyBullets, bossBullets]) {
      for (const bullet of pool.all) {
        if (!bullet.active) continue
        const bx = bullet.sprite.x - BULLET_R, by = bullet.sprite.y - BULLET_R
        if (overlaps(bx, by, BULLET_R * 2, BULLET_R * 2, px, py, ph.width, ph.height)) {
          if (!player.hit()) continue
          pool.release(bullet)
          return
        }
        if (!bullet.grazed && overlaps(bx, by, BULLET_R * 2, BULLET_R * 2, player.x - g, player.y - g, g * 2, g * 2)) {
          bullet.grazed = true; gameStore.getState().addGraze(); audioSystem.playGraze()
        }
      }
    }
  }
}
