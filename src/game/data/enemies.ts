/** energy: cyan hollow ring, absorbable. missile: orange arrow, must be
 *  dodged, dashed through or shot down. */
export type BulletKind = 'energy' | 'missile'

export interface EnemyDef {
  sprite: string
  hp: number
  speed: number
  scoreValue: number
  fireRate: number
  bulletSpeed: number
  scale: number
  engineColor?: number
  engineCount?: 1 | 2 | 3
  usesLaser?: boolean
  attackType?: 'straight' | 'aimed' | 'spread' | 'ring' | 'spiral' | 'aimed-fan'
  spreadCount?: number
  bulletCount?: number  // ring: bullets per volley / spiral: arms / aimed-fan: fan size
  bulletKind?: BulletKind   // default 'energy'
  /** 'hover' path only: seconds spent holding station before leaving. */
  hoverTime?: number
}

export const ENEMIES: Record<string, EnemyDef> = {
  // ── Phase 1 arena ─────────────────────────────────────────
  // Patrol drone: teaches absorbing. Fragile, holds station, and fires a slow
  // forward 3-way of energy rounds — easy to read, easy to catch.
  drone: {
    sprite: './assets/enemies/enemy-fighter.png',
    hp: 8, speed: 110, scoreValue: 120,
    fireRate: 1.5, bulletSpeed: 165, scale: 0.78,
    engineColor: 0x37dfff, engineCount: 1,
    attackType: 'spread', spreadCount: 3, bulletKind: 'energy',
    hoverTime: 6,
  },
  // Missile interceptor: the contrast case. Its aimed missiles cannot be
  // absorbed, so it teaches that the core is not a universal shield.
  missileer: {
    sprite: './assets/enemies/enemy-elite.png',
    hp: 16, speed: 90, scoreValue: 300,
    fireRate: 2.3, bulletSpeed: 235, scale: 0.82,
    engineColor: 0xff7a24, engineCount: 2,
    attackType: 'aimed', bulletKind: 'missile',
    hoverTime: 7,
  },
  // ── Stage 1 ───────────────────────────────────────────────
  fighter: {
    sprite: './assets/enemies/enemy-fighter.png',
    hp: 1, speed: 120, scoreValue: 100,
    fireRate: 1.4, bulletSpeed: 230, scale: 0.78,
  },
  bomber: {
    sprite: './assets/enemies/enemy-bomber.png',
    hp: 3, speed: 70, scoreValue: 300,
    fireRate: 1.4, bulletSpeed: 170, scale: 0.82,
    attackType: 'ring', bulletCount: 8,
  },
  scout: {
    sprite: './assets/enemies/enemy-scout.png',
    hp: 1, speed: 200, scoreValue: 150,
    fireRate: 2.0, bulletSpeed: 210, scale: 0.72,
  },
  // ── Stage 2 ───────────────────────────────────────────────
  interceptor: {
    sprite: './assets/enemies/enemy-interceptor.png',
    hp: 1, speed: 240, scoreValue: 180,
    fireRate: 1.2, bulletSpeed: 300, scale: 0.72,
    engineColor: 0x37dfff, engineCount: 2,
    attackType: 'aimed',
  },
  gunship: {
    sprite: './assets/enemies/enemy-gunship.png',
    hp: 4, speed: 80, scoreValue: 350,
    fireRate: 0, bulletSpeed: 0, scale: 0.8,
    engineColor: 0x37dfff, engineCount: 2,
    usesLaser: true,
  },
  // ── Stage 3 ───────────────────────────────────────────────
  elite: {
    sprite: './assets/enemies/enemy-elite.png',
    hp: 2, speed: 200, scoreValue: 250,
    fireRate: 0.9, bulletSpeed: 280, scale: 0.76,
    engineColor: 0xff7a24, engineCount: 2,
    attackType: 'aimed-fan', bulletCount: 3,
  },
  carrier: {
    sprite: './assets/enemies/enemy-carrier.png',
    hp: 6, speed: 55, scoreValue: 500,
    fireRate: 0.3, bulletSpeed: 150, scale: 0.82,
    engineColor: 0xff7a24, engineCount: 3,
    attackType: 'spiral', bulletCount: 2,
  },
}
