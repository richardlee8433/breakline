import { PickupPool } from '../entities/Pickup'
import { BOMB } from '../data/core'

// Every kill path uses this table: 2% 1UP, BOMB.dropChance bomb. The first
// bomb of a run is guaranteed by the BOMB.pityKills-th kill, so the bomb
// tutorial always happens early rather than whenever luck allows.
const ONEUP_CHANCE = 0.02

let kills = 0
let bombDropped = false

/** Start-of-run reset for the bomb guarantee. */
export function resetDrops() {
  kills = 0
  bombDropped = false
}

export function spawnEnemyDrop(pickups: PickupPool, x: number, y: number) {
  kills++
  const roll = Math.random()
  if (roll < BOMB.dropChance || (!bombDropped && kills >= BOMB.pityKills)) {
    bombDropped = true
    pickups.spawn(x, y, 'bomb')
  } else if (roll < BOMB.dropChance + ONEUP_CHANCE) {
    pickups.spawn(x, y, 'oneup')
  }
}
