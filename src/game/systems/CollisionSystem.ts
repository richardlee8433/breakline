import { Rectangle } from 'pixi.js'
import { Bullet, BulletPool } from '../entities/BulletPool'
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

function intersects(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

const GRAZE_RADIUS = 22 * SPRITE_SCALE
const BULLET_R = 3 * SPRITE_SCALE
const PLASMA_CANCEL_DISTANCE = BULLET_R * 0.35
const PLASMA_CANCEL_CHANCE = 0.25

function sweptBulletDistanceSq(a: Bullet, b: Bullet): number {
  const startX = a.prevX - b.prevX, startY = a.prevY - b.prevY
  const travelX = (a.sprite.x - b.sprite.x) - startX, travelY = (a.sprite.y - b.sprite.y) - startY
  const travelSq = travelX * travelX + travelY * travelY
  const t = travelSq === 0 ? 0 : Math.max(0, Math.min(1, -(startX * travelX + startY * travelY) / travelSq))
  const closestX = startX + travelX * t, closestY = startY + travelY * t
  return closestX * closestX + closestY * closestY
}

export class CollisionSystem {
  check(playerBullets: BulletPool, enemyBullets: BulletPool, bossBullets: BulletPool, enemies: Enemy[], boss: Boss | null, player: Player, explosions: ExplosionPool, pickups: PickupPool, gems: GemPool, floats: FloatingTextPool) {
    for (const bullet of playerBullets.active) {
      const br = new Rectangle(bullet.sprite.x - BULLET_R, bullet.sprite.y - BULLET_R * 2, BULLET_R * 2, BULLET_R * 4)

      for (const enemy of enemies) {
        if (!intersects(br, enemy.hitboxWorld)) continue
        if (bullet.penetrates && bullet.hitEnemyIds.has(enemy)) continue
        if (bullet.penetrates) bullet.hitEnemyIds.add(enemy)
        else playerBullets.release(bullet)

        enemy.hp -= bullet.damage
        if (enemy.hp > 0) enemy.flash()
        if (enemy.hp <= 0) {
          explosions.spawn(enemy.sprite.x, enemy.sprite.y, 2); screenShake.trigger(1.5); hitstop.trigger(0.025); audioSystem.playExplosion('small')
          const { awarded, mult } = gameStore.getState().addKillScore(enemy.scoreValue)
          floats.spawn(enemy.sprite.x, enemy.sprite.y - 10, `+${awarded}`, multColor(mult))
          spawnEnemyDrop(pickups, enemy.sprite.x, enemy.sprite.y)
          gems.spawn(enemy.sprite.x, enemy.sprite.y, Math.random() < 0.35 ? 2 : 1)
          enemy.deactivate()
        }
        // Conventional rounds stop at their first target. Plasma continues and
        // can damage other ships in the same formation once each.
        if (!bullet.penetrates) break
      }

      if (boss?.active && bullet.active && intersects(br, boss.hitboxWorld)) {
        const impactX = bullet.sprite.x, impactY = bullet.sprite.y
        // Plasma keeps its ordinary boss behaviour: it does not pierce through
        // the boss or repeatedly damage it on consecutive frames.
        playerBullets.release(bullet)
        const died = boss.hit(bullet.damage, impactX, impactY)
        screenShake.trigger(died ? 5 : 3); audioSystem.playBossHurt()
        if (died) { explosions.spawn(boss.sprite.x, boss.sprite.y, 2.5); hitstop.trigger(0.12); bossBullets.releaseAll(); gems.spawn(boss.sprite.x, boss.sprite.y, 16); gems.magnetizeAll() }
      }
    }

    const cancelDistanceSq = PLASMA_CANCEL_DISTANCE * PLASMA_CANCEL_DISTANCE
    for (const bullet of playerBullets.active) {
      if (!bullet.cancelsHostile) continue
      let cancelled = false
      for (const hostilePool of [enemyBullets, bossBullets]) {
        for (const hostile of hostilePool.active) {
          if (sweptBulletDistanceSq(bullet, hostile) > cancelDistanceSq) continue
          if (Math.random() >= PLASMA_CANCEL_CHANCE) continue
          const impactX = (bullet.sprite.x + hostile.sprite.x) * 0.5, impactY = (bullet.sprite.y + hostile.sprite.y) * 0.5
          playerBullets.release(bullet); hostilePool.release(hostile); explosions.spawn(impactX, impactY, 0.45)
          cancelled = true; break
        }
        if (cancelled) break
      }
    }

    const grazeRect = new Rectangle(player.x - GRAZE_RADIUS, player.y - GRAZE_RADIUS, GRAZE_RADIUS * 2, GRAZE_RADIUS * 2)
    if (player.isDead) return
    const allHostileBullets = [...enemyBullets.active, ...bossBullets.active]
    for (const bullet of allHostileBullets) {
      const br = new Rectangle(bullet.sprite.x - BULLET_R, bullet.sprite.y - BULLET_R, BULLET_R * 2, BULLET_R * 2)
      if (intersects(br, player.hitboxWorld)) {
        if (!player.hit()) continue
        const pool = enemyBullets.active.includes(bullet) ? enemyBullets : bossBullets
        pool.release(bullet); break
      }
      if (!bullet.grazed && intersects(br, grazeRect)) { bullet.grazed = true; gameStore.getState().addGraze(); audioSystem.playGraze() }
    }
  }
}
