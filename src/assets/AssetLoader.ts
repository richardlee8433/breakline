import { Texture } from 'pixi.js'

export interface GameAssets {
  playerShip: Texture
  explosionFrames: Texture[]
}

const EXPLOSION_TILES = [16, 17, 18, 19, 20, 21]

// Load via HTMLImageElement instead of Pixi's Assets.load(), which uses a
// blob-URL worker (null origin) that gets 403'd by VIVERSE's CDN.
export function loadTexture(src: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(Texture.from(img))
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

export async function loadAssets(): Promise<GameAssets> {
  const [playerShip, ...explosionFrames] = await Promise.all([
    './assets/ships/player-hero.png',        // player (hi-res, alpha-keyed)
    ...EXPLOSION_TILES.map((i) =>
      `./assets/kenney/Tiles/tile_${String(i).padStart(4, '0')}.png`,
    ),
  ].map(loadTexture))

  return { playerShip, explosionFrames }
}
