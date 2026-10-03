# BREAKLINE

Lastlight 同宇宙的短篇縱向卷軸射擊冒險。你駕駛一架裝上古文明核心的拼裝戰機：接住敵方的能源砲火，轉成自己的反擊武器，替撤離船打開 Helion 的封鎖線。

> **狀態：Phase 1 前的基線。** 程式碼從 [neon-raiden](https://github.com/richardlee8433/neon-raiden) fork 出來，已經移除 BURST、炸彈和 VIVERSE 排行榜。吸收、衝刺、反擊還沒實作。設計文件見 [`docs/Breakline_Game_Plan_v0.1.txt`](docs/Breakline_Game_Plan_v0.1.txt)。

## Run Locally

```bash
npm install
npm run dev
```

## Controls（目前）

| Action | Key | Touch |
|---|---|---|
| Move | Arrow Keys / WASD | Drag |
| Fire | Space | 觸控時自動 |
| Focus（慢速、顯示 hitbox） | Hold Shift | — |
| Pause | P / Esc | 點擊畫面 |
| Mute | M | 🔊 |

Phase 1 會改成：射擊自動、Shift 吸收、Space 衝刺、E/C 反擊，詳見 [CLAUDE.md](CLAUDE.md)。

## 從 neon-raiden 沿用的部分

- Pixi.js v8 渲染、bloom 後處理、landscape 中央 combat corridor 版面
- 子彈、敵機、爆炸、gem、pickup、浮動文字的物件池
- 資料化的三關波次、7 種敵機、3 階段 Boss
- 極座標彈幕產生器（ring / spiral / flower / aimed-fan）
- 音效 / BGM 系統
- Shockwave、Hitstop、ScreenShake 等打擊演出（之後由反擊武器重用）

## Roadmap

1. **Phase 1 戰鬥原型**：吸收 / 衝刺 / 脈衝反擊、能源與熱量、可吸收與不可吸收兩種子彈
2. **Phase 2 完整一關**：教學、通訊、可拆炮塔 Boss
3. **Phase 3 三關故事版**
4. **Phase 4 打磨**：手機、輔助難度、街機模式

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
