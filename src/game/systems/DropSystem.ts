import { PickupPool } from '../entities/Pickup'

// Every kill path uses this table. The only drop left is a 1UP: the gun
// no longer levels up, and the core's resources come from absorbing fire.
const ONEUP_CHANCE = 0.02

export function spawnEnemyDrop(pickups: PickupPool, x: number, y: number) {
  if (Math.random() < ONEUP_CHANCE) pickups.spawn(x, y, 'oneup')
}
