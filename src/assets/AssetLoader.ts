import { Texture } from 'pixi.js'

export interface GameAssets {
  playerShip: Texture
  playerBullet: Texture
  enemyBullet: Texture
  bossBullet: Texture
  bossShip: Texture
  pickupPower: Texture
  pickupOneUp: Texture
  pickupLaser: Texture
  pickupPlasma: Texture
  gem: Texture
  explosionFrames: Texture[]
}

const EXPLOSION_TILES = [16, 17, 18, 19, 20, 21]

// Load via HTMLImageElement instead of Pixi's Assets.load(), which uses a
// blob-URL worker (null origin) that gets 403'd by VIVERSE's CDN.
function loadTexture(src: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(Texture.from(img))
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

export async function loadAssets(): Promise<GameAssets> {
  const paths = [
    './assets/ships/player-hero.png',        // player (hi-res, alpha-keyed)
    './assets/kenney/Tiles/tile_0000.png',   // player bullet
    './assets/kenney/Tiles/tile_0008.png',   // enemy bullet
    './assets/kenney/Tiles/tile_0010.png',   // boss bullet (larger)
    './assets/kenney/Ships/ship_0015.png',   // boss ship
    './assets/pickups/pickup-power.png',
    './assets/pickups/pickup-oneup.png',
    './assets/pickups/pickup-laser.png',
    './assets/pickups/pickup-plasma.png',
    './assets/pickups/gem-gold.png',
    ...EXPLOSION_TILES.map((i) =>
      `./assets/kenney/Tiles/tile_${String(i).padStart(4, '0')}.png`,
    ),
  ]

  const textures = await Promise.all(paths.map(loadTexture))

  return {
    playerShip:      textures[0],
    playerBullet:    textures[1],
    enemyBullet:     textures[2],
    bossBullet:      textures[3],
    bossShip:        textures[4],
    pickupPower:     textures[5],
    pickupOneUp:     textures[6],
    pickupLaser:     textures[7],
    pickupPlasma:    textures[8],
    gem:             textures[9],
    explosionFrames: textures.slice(10),
  }
}
