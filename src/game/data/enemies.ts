/** energy: cyan hollow ring, harmless, absorbed by the field.
 *  missile: orange arrow, solid, must be dodged. */
export type BulletKind = 'energy' | 'missile'

export interface EnemyDef {
  sprite: string
  /** Pursuit speed toward its station behind the ship (base px/s). */
  speed: number
  scale: number
  engineColor: number
  engineCount: 1 | 2 | 3
  /** Seconds between attacks once on station. */
  fireRate: number
  bulletSpeed: number
  /** fan: an aimed fan of energy rounds. missile: lock on, then one aimed
   *  missile. guided: lock on, then a missile that turns after the ship
   *  (GUIDED in chase.ts). */
  attack: 'fan' | 'missile' | 'guided'
  fanCount?: number
  /** Seconds it keeps up the chase before falling back on its own. */
  chaseTime: number
  /** Stage 3's EMP-hardened pursuers recover sooner. */
  hardened?: boolean
}

export const ENEMIES: Record<string, EnemyDef> = {
  // Energy drone: the EMP's fuel. Sprays slow cyan rings at the ship.
  drone: {
    sprite: './assets/enemies/enemy-fighter.png',
    speed: 220, scale: 0.78,
    engineColor: 0x37dfff, engineCount: 1,
    fireRate: 2.4, bulletSpeed: 170,
    attack: 'fan', fanCount: 3,
    chaseTime: 15,
  },
  // Missile patrol: the solid threat. Locks on (marker + cue), then fires.
  missileer: {
    sprite: './assets/enemies/enemy-elite.png',
    speed: 200, scale: 0.82,
    engineColor: 0xff7a24, engineCount: 2,
    fireRate: 2.3, bulletSpeed: 250,
    attack: 'missile',
    chaseTime: 20,
  },
  // Stage 3 — guided missile ship: its missiles turn after the ship, but
  // slowly and not for long. Cross their path to lose them.
  guided: {
    sprite: './assets/enemies/enemy-interceptor.png',
    speed: 210, scale: 0.8,
    engineColor: 0xff4fa0, engineCount: 2,
    fireRate: 3.0, bulletSpeed: 215,
    attack: 'guided',
    chaseTime: 18,
  },
  // Stage 3 — EMP-hardened pursuer: a heavier silhouette and violet
  // engines. An EMP still stops it, for 1.5 s instead of 4.
  hardened: {
    sprite: './assets/enemies/enemy-gunship.png',
    speed: 190, scale: 0.84,
    engineColor: 0xb06bff, engineCount: 2,
    fireRate: 2.4, bulletSpeed: 250,
    attack: 'missile',
    chaseTime: 22,
    hardened: true,
  },
}
