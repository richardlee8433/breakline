// Player ship tuning. Lengths are in base (480-wide) pixels; Player.ts scales
// them by SPRITE_SCALE so the landscape layout keeps the same feel.

export const PLAYER = {
  speed: 300,
  displayH: 72,
  /** Damage-taking core. Tiny on purpose: wings brushing bullets are safe. */
  hitboxSize: 6,
  bankAngle: 0.22,

  respawnDelay: 1.1,
  respawnFlySpeed: 300,
  respawnInvincible: 3,

  // Normal shot: always on (auto-fire). Its level comes from the core's
  // energy (ENERGY.perLevel per level), not from pickups.
  bulletSpeed: 620,
  shotDamage: 1,
  /** Seconds between volleys, per level 0–4. */
  fireInterval: [0.14, 0.13, 0.12, 0.10, 0.08],
  /** Unit direction vectors per level 0–4, one bullet each per volley. */
  shotPattern: [
    [[0, -1]],
    [[-0.07, -1], [0.07, -1]],
    [[-0.10, -0.995], [0, -1], [0.10, -0.995]],
    [[-0.14, -0.99], [-0.04, -1], [0.04, -1], [0.14, -0.99]],
    [[-0.16, -0.987], [-0.08, -0.997], [0, -1], [0.08, -0.997], [0.16, -0.987]],
  ] as [number, number][][],
}
