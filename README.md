# Raiden Pixel Assault

A vertical-scrolling shoot 'em up (shmup) built with React + Pixi.js v8, blending classic Raiden-style action with danmaku (bullet-hell) mechanics: a 6px hitbox, graze scoring, focus movement, an exclusive three-weapon loadout, kill chains, a two-tier BURST gauge, and geometric bullet patterns. Three stages loop endlessly at rising difficulty. Playable in any modern browser — no install required.

---

## Run Locally

```bash
npm install
npm run dev
# open http://localhost:5174
```

---

## Controls

| Action | Key | Touch |
|---|---|---|
| Move | Arrow Keys / WASD | Drag anywhere on screen |
| Fire | Space | Automatic while touching |
| Focus (slow, shows hitbox) | Hold Shift | — |
| Bomb (screen clear) | X / B | 💣 button (bottom-right) |
| BURST (spend a full gauge) | C / V | BURST button (above 💣) |
| Pause | P / Esc | Tap overlay to resume |
| Mute / Unmute | M | 🔊 button |

---

## Layouts

The stage size is computed once at load from the viewport's aspect ratio, then CSS-scaled to fill the screen on both axes.

**Portrait (phones)** — the classic arcade column: 480 wide, height stretched to the device (640–1040). The HUD sits in a single bar across the top.

**Landscape (desktop / VIVERSE iframe)** — 900 tall, width stretched up to 1600. Combat is confined to a **central 720px corridor**; gameplay layers are masked to it so ships never fly in out in the open. The nebula continues into the side wings, which are dimmed with a stepped gradient and edged with a faint rule, and the HUD moves out into those wings instead of sitting over the playfield.

Sprites, hitboxes, bullet size, graze radius, and player speed all scale by the same `SPRITE_SCALE` factor, so the danmaku relationships are identical on every layout. Horizontal formations multiply their counts by `FORMATION_SCALE` so a wide field keeps the same enemy density per screen-width.

---

## Stages

| Stage | Theme | Enemies | Boss HP |
|---|---|---|---|
| 1 — Deep Space | Teal-blue nebula | Fighter · Scout · Bomber | 500 |
| 2 — Nebula Field | Vivid purple nebula | Interceptor · Gunship | 600 |
| 3 — Asteroid Belt | Eerie green nebula | Elite · Carrier | 850 |

Each stage scrolls a distinct seamless planetary background with a faster procedural star layer on top for parallax depth, runs 12–15 timed waves, and ends with a 3-phase boss at 42–46 seconds. Every enemy type has dedicated art (`public/assets/enemies/`) with its own engine-exhaust color and glow count.

**Endless loop** — clearing stage 3 wraps back to stage 1 as **LOOP 2**, not a game over. Each loop raises the rank (capped at loop 5), and the stage announcement warns `ENEMY FORCES INTENSIFIED`:

| Per rank | Enemies | Bosses |
|---|---|---|
| Speed | +12% | — |
| Bullet speed | +15% | +12% |
| Fire rate | +10% faster | +8% faster |
| HP | — | +25% |

The HUD shows `LOOP n` once you're past the first playthrough.

---

## Weapons

Three weapons, but only one is ever active — picking up a different weapon's drop switches you to it, keeping that weapon's own level in reserve for when you switch back. The HUD names the equipped weapon instead of showing meter bars.

**Vulcan** (`power` pickups, levels 0–4, default at run start). A conventional ballistic weapon: tight, precise spread at the fastest fire rate of the three, no gimmicks — just the most bullets on target per second.

| Level | Shots | Spread | Fire interval |
|---|---|---|---|
| 0 | 1 | Straight up | 0.14s |
| 1 | 2 | ±4° | 0.13s |
| 2 | 3 | ±6° | 0.12s |
| 3 | 4 | ±5° / ±8° | 0.10s |
| 4 | 5 | ±5° / ±9° | 0.08s |

**Laser** (`laser` pickups, levels 0–5). Holding fire projects a continuous beam straight up from the ship to the top of the screen — four stacked strokes (soft aura → mid glow → inner glow → white-hot core) with a pulsing muzzle ring. Deals 30 damage/second to anything in its column above the ship. Boss damage scales with level (bosses resist the beam ~75% at baseline, easing as level rises) — roughly 8–21 DPS across levels 1–5 — so a fresh pickup is a real but modest threat to a boss, and a maxed one is worth holding onto through the fight. Beam width scales 1.00×–2.07× with level (each level +20% over the last).

**Plasma** (`plasma` pickups, levels 0–4). The crowd-control option: a wide fan of up to 9 bolts at max level, trading per-bolt damage (0.55×) and speed (0.82×) for coverage — good against a packed formation, weak against a single hard target. Fire rate is the slowest of the three (0.34s–0.24s). A bolt **penetrates enemies** (each one takes damage once, not every frame it overlaps) but still stops on contact with a boss. Fits its energy-orb identity with a defensive trick: a Plasma bolt has a 25% chance to cancel an enemy or boss bullet it touches on contact.

Dying drops two levels of whichever weapon you had equipped (not always Vulcan), scattering two matching pickups at the crash site — so a death doesn't force a weapon switch on top of the setback.

---

## Pickups

Destroyed enemies roll a single drop, 19% of the time overall:

| Pickup | Chance | Effect |
|---|---|---|
| **1UP** | 2% | +1 life (max 5) |
| **B** — bomb | 6% | +1 bomb (max 5) |
| Weapon (Vulcan / Laser / Plasma) | 11% | +1 level of the weapon rolled (max 4 or 5), and switches you to it |

The weapon roll is weighted, not an even three-way split — it favors the weapon you already have equipped (so you can build one up instead of getting yanked between weapons) and each stage's featured weapon (stage 1 → Vulcan, stage 2 → Laser, stage 3 → Plasma), with a small baseline chance for the rest.

**Deathbomb** — a fatal hit doesn't kill instantly: the ship flashes red for a 0.15s grace window, and bombing within it cancels the death (spending one bomb, granting 1.5s of invincibility) — a classic hardcore-shmup safety net.

**Death penalty & respawn** — dying drops two levels of your currently equipped weapon (two matching pickups scatter back at the crash site), then after a 1.1s beat the ship flies in from the bottom edge with 3s of invincibility frames. Death also breaks the kill chain.

---

## Danmaku Mechanics

**Tiny hitbox** — only a 6px point at the ship's core takes damage. Wings brushing through bullet curtains are safe; hold Shift to move at 40% speed and see the glowing hitbox dot.

**Graze** — enemy bullets passing within 22px of the hitbox without hitting award +50 points each (once per bullet), with a high-pitched tick, **and charge the BURST gauge by 0.7**. That last part is what makes grazing worth the risk: flying into a curtain is the fastest way to buy your next power spike, not just a score trickle. The HUD tracks your total graze count.

**Geometric bullet patterns** — enemy fire is choreographed with polar-coordinate emitters (`BulletPatterns.ts`):

| Pattern | Shape | Used by |
|---|---|---|
| `ring` | Evenly spaced full circle | Bomber (8-way) |
| `spiral` | Rotating arms, advances per volley | Carrier (2-arm), bosses |
| `flower` | Speed modulated by sin(petals·θ) — petal outline | Boss phase 3 |
| `aimed-fan` | Fan centered on the player | Elite (3-way), bosses |

Enemy bullets are glowing neon rounds (pink for enemies, cyan for bosses) generated procedurally, so they pop against the dark background. The Gunship fires a sustained vertical laser instead of bullets.

---

## BURST

Chain already multiplied score, but nothing about the ship changed as it climbed — a 20-kill chain felt identical to a 2-kill one. **BURST** closes that gap: the gauge you fill by playing dangerously buys a window where the ship actually hits harder.

**Charging** — the gauge fills from two sources, and the graze half is the point: it welds the danmaku layer onto the scoring layer.

| Source | Gauge |
|---|---|
| Graze (per bullet) | +0.7 |
| Kill | +0.8 + `scoreValue` / 300 (≈1.1 for a fighter, ≈2.5 for a carrier) |

**Spending** — at a full gauge the HUD meter turns gold and reads `BURST READY [C]`. Pressing C/V ignites:

| | BURST | DOUBLE BURST |
|---|---|---|
| Damage | ×2 | ×3 |
| Fire interval | ×0.70 | ×0.55 |
| Score multiplier | ×2 | ×4 — *stacked on top of the chain tier, so a ×8 chain becomes ×32* |
| Gauge drain | 12.5 / s (8s untended) | 20 / s (5s untended) |
| Hull tint | Amber | Magenta |

Ignition cancels every hostile bullet on screen and **mints a gem from each one** (capped at 18, so one activation can't drain the gem pool) — the reward for bursting *inside* a curtain is the curtain itself. It also fires a shockwave, a short hitstop, and 0.7s of invincibility.

**The gauge is the burst's own fuel.** It drains while a burst runs, but kills and grazes keep topping it up, so a strong run extends its own window — and if you refill it to full before it empties, pressing the key again upgrades to **DOUBLE BURST** and refreshes the meter rather than ending it. That's the ceiling: there is no third tier.

Every player damage source scales with the tier, Laser included, so bursting never punishes your weapon choice. Ignition is edge-triggered — holding the key through a charging gauge won't auto-spend it the instant it tops out. Dying ends any active burst and halves the gauge; a stage transition ends the burst but keeps the charge.

All of it is tuning data in [`src/game/data/burst.ts`](src/game/data/burst.ts).

---

## Scoring

**Kill chain** — consecutive kills build a chain that lapses after 2 seconds of silence (or on death). Its tier multiplies every kill's score, and the HUD chain counter grows and shifts color as it climbs:

| Chain | Multiplier | Color |
|---|---|---|
| 5+ | ×2 | Yellow |
| 10+ | ×4 | Orange |
| 20+ | ×8 | Pink |

An active BURST multiplies on top of this tier, so the practical ceiling is ×32 per kill.

**Floating score popups** — every kill spawns a pooled `+300`-style number at the kill site that drifts up and fades, tinted to the chain tier so the multiplier is readable without looking at the HUD.

**Score gems & magnet collect** — destroyed enemies scatter gold gems (+100 each, 35% chance of two). Gems near the ship latch on automatically and keep homing once attracted; fly to the top quarter of the screen (or kill a boss, which drops 16) and **every gem on screen vacuums toward you**. Consecutive pickups raise the collect chime pitch one semitone at a time.

**High score** — your best is written to `localStorage` on every new record, so it survives a refresh mid-run.

---

## Boss Phases

Every boss entrance is announced by a flashing **WARNING** banner and air-raid siren for 2.4s while the field clears (the boss art is prefetched during the siren so it never pops in late). Bosses then cycle through 3 phases as HP drops:

- **Phase 1** (100–67% HP) — sweep left/right · slow 14-bullet rings alternating with aimed fans
- **Phase 2** (67–33% HP) — faster sweep · 3-arm spiral with a wide aimed fan every 4th volley
- **Phase 3** (33–0% HP) — erratic movement · dense 4-arm spiral + expanding flower bursts

**Persistent damage feedback** — below 67% HP the hull shows 2 burning wound sites (4 below 33%), each a flickering fire-and-smoke decal anchored to a boss-specific location; the hull's tint darkens toward char as HP drops. Every hit also flashes a brief impact burst at the exact point of contact and kicks a short, decaying camera shake, with a bigger jolt on each phase transition — so damage reads continuously, not just from the HP bar.

Killing one runs a death spectacle — cascading explosions, hitstop, screen shake, a gem burst, and a full-screen vacuum.

---

## Visual Effects

| Effect | Trigger | Detail |
|---|---|---|
| Bloom post-processing | Always on | `AdvancedBloomFilter` (pixi-filters) — two passes: one clipped to the combat corridor for bullets, one full-screen for fx |
| Engine exhaust | Always on | Blue flame particles streaming from the ship's tail (48-particle pool) |
| Hull banking | Strafing | Lerped ±0.22 rad tilt into the movement direction |
| Bullet trails | Every player shot | White-hot core → yellow → orange, 22px gradient behind each bullet |
| Enemy hit flash | Non-lethal hit | Red tint plus a 6-point spark burst at the impact point |
| Enemy engine glow | Always on | Per-enemy exhaust flicker, color and count set per enemy type |
| Hitstop | Impacts | Freeze-frame: kill 0.025s · boss death 0.12s · bomb 0.08s · player death 0.15s |
| Bomb shockwave | Bomb | Expanding ring from the ship (replaces a flat white flash) |
| Boss WARNING | Boss approach | Field clears, flashing red banner + air-raid siren for 2.4s |
| Screen shake | Hits & explosions | Enemy kill: 1.5 · Boss hit: 3 · Boss death: 5 · Bomb & player death: 8 |

---

## Audio

Sampled CC0 audio, ~3 MB of OGG Vorbis. Every mix decision — file, level, retrigger throttle, pitch jitter — is data in [`src/game/data/audio.ts`](src/game/data/audio.ts), so swapping a sample is a one-line edit.

Two playback paths, chosen deliberately:

- **SFX** are decoded into `AudioBuffer`s (`SampleBank.ts`) — they need sample-accurate latency, overlapping voices, and per-trigger pitch. Capped at 24 simultaneous voices.
- **Music** streams through `<audio>` elements (`MusicSystem.ts`) — decoding ~3 minutes of BGM as PCM would cost well over 100 MB of RAM for nothing.

**BGM** — one track per stage, plus a boss theme whose 2.1s intro is started on the WARNING banner so its main loop lands exactly as the boss finishes entering. Tracks crossfade in 260 ms; muting holds position rather than stopping, so unmuting drops back in where the track is.

| Track | When |
|---|---|
| `title.ogg` | Title screen |
| `stage1/2/3.ogg` | Per stage |
| `boss-intro.ogg` → `boss-loop.ogg` | WARNING banner → boss fight |
| `stage-clear.ogg` | Stage cleared |

| Sound | Trigger | Sample |
|---|---|---|
| Shot | Firing | `smallshot2` (0.20s — long samples smear at 10 shots/sec) |
| Explosion (small) | Enemy killed | `explosion1` |
| Explosion (large) | Bomb | `explosion3` |
| Boss explosion | Boss death | `explosion4` |
| Boss hit tick | Boss damaged | `smallshot4` |
| Player hit | Death | `explosion2` |
| Chime | Pickup collected | Kenney `confirmation` / `maximize` |
| Rising ping | Gem collected (pitch climbs a semitone per streak) | `gem` |
| High tick | Graze (near-miss) | `graze` |
| Air-raid siren | Boss WARNING | `alarm3` |
| Ready chime | BURST gauge tops out | `pickup-alt` |
| Ignition hit | BURST activated (a fifth higher for DOUBLE) | `bigshot3` |

Twenty more variants ship in `public/assets/audio/sfx/` (extra alarms, lasers, big shots) for auditioning alternatives without re-downloading.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 6 |
| Rendering | Pixi.js v8 (WebGL2) |
| Post-processing | pixi-filters (AdvancedBloomFilter) |
| State | Zustand 5 |
| Language | TypeScript 5.6 |
| Assets | Kenney Pixel Shmup (CC0) for bullets/tiles, plus custom ship/enemy/pickup art and backgrounds — see [License](#license) |
| Audio | OGG Vorbis samples · Web Audio API (SFX) + `<audio>` streaming (music) |

---

## Architecture

```
src/
  game/
    config.ts                       — Stage dimensions, corridor bounds, sprite scale
    core/       GameApp.ts          — Pixi Application, main ticker, stage transitions
    data/       stages.ts           — Per-stage wave/boss config
                enemies.ts          — Enemy stat table
                burst.ts            — BURST gauge rates and per-tier multipliers
                audio.ts            — Sound manifest: file, gain, throttle, detune
    entities/   Player.ts           — Movement, focus, 6px hitbox, banking, deathbomb, respawn, BURST scaling
                Enemy.ts            — Move paths: straight/zigzag/sine/swoop/dive/diagonal · fire patterns · per-type engine glow + hit sparks
                Boss.ts             — 3-phase danmaku boss with per-stage + per-loop scaling, persistent damage decals, impact FX
                BulletPool.ts       — Object pool (zero new in game loop); per-shot damage/tint/scale/texture, Plasma bullet-cancel flag
                Pickup.ts           — Power / bomb / laser / plasma / 1UP drops
                Gem.ts              — Score gems with magnet attraction
    systems/    InputSystem.ts      — Unified action map (keyboard + touch drag)
                BulletPatterns.ts   — Polar-coordinate danmaku emitters (ring/spiral/flower/fan)
                WaveSystem.ts       — Timed wave spawner with per-loop rank scaling
                DropSystem.ts       — Weighted enemy-kill drop table (weapon rolls favor equipped + stage weapon)
                CollisionSystem.ts  — AABB collision, graze detection, drop rolls, Plasma-vs-hostile-bullet cancel
                ScrollSystem.ts     — Seamless nebula tile + parallax stars (3 themes)
                SampleBank.ts       — Fetch/decode/play pooled one-shot samples
                AudioSystem.ts      — Game-event → sample mapping
                MusicSystem.ts      — Streaming BGM, crossfades, boss intro→loop
    fx/         Explosion.ts        — Frame-animation pool
                LaserBeam.ts        — Player beam render + continuous damage
                BombEffect.ts       — Screen-wide flash overlay
                Shockwave.ts        — Expanding bomb ring
                Hitstop.ts          — Global freeze-frame on impact
                FloatingText.ts     — Pooled score popups, tinted by chain tier
                EngineExhaust.ts    — Glowing engine-flame particle pool
                BulletTrail.ts      — Per-frame gradient trail behind player bullets
                GlowTexture.ts      — Procedural neon glow bullet + gem textures
                ScreenShake.ts      — Stage offset with exponential decay
  store/        gameStore.ts        — Zustand: score, chain, burst gauge + tier, loop, lives, equipped weapon + its level, stage
  ui/           HUD.tsx             — React overlay (score/chain/BURST meter/equipped weapon/boss HP, wing or bar layout)
                TitleScreen.tsx
                GameOverScreen.tsx
                StageClearScreen.tsx
                StageAnnouncement.tsx
  assets/       AssetLoader.ts      — Pixi Assets.load
```

**Key design rules:**
- Game loop runs entirely inside Pixi ticker — React only handles HUD overlay
- All bullets, enemies, explosions, gems, pickups, and score popups use pre-allocated object pools
- Wave data, enemy stats, and boss configs are pure data in `data/`, not hardcoded in classes
- `gameStore` (Zustand) is the single source of truth — read via `getState()` inside the ticker
- Layout constants live in `config.ts` and are computed once at load, never per frame

---

## License

Code: MIT

All assets are CC0 (public domain):

| Asset | Source |
|---|---|
| Bullets & tiles | [Kenney Pixel Shmup](https://kenney.nl/assets/pixel-shmup) |
| Ships, enemy & pickup art | Custom (`public/assets/ships`, `public/assets/enemies`, `public/assets/pickups`) — **source/license not yet recorded, confirm before any public release** |
| Backgrounds | `public/assets/bg` carries a Screaming Brain Studios CC0 notice from an earlier version of these files; the current planetary artwork's own source isn't recorded — **confirm before any public release** |
| Music | [SketchyLogic — NES Shooter Music](https://opengameart.org/content/nes-shooter-music-5-tracks-3-jingles) |
| Weapon & explosion SFX | [RUOK — Action Game/SHMUP SFX Pack](https://opengameart.org/content/action-gameshmup-sfx-pack) |
| UI SFX | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) |
