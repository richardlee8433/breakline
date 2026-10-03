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

  // Normal shot: always on (auto-fire), never upgraded. Breakline's power
  // curve lives in the core's counter-attack, not in the gun.
  bulletSpeed: 620,
  fireInterval: 0.12,
  shotDamage: 1,
  /** Unit direction vectors, one bullet each per volley. */
  shotPattern: [[-0.10, -0.995], [0, -1], [0.10, -0.995]] as [number, number][],
}
