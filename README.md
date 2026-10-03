# BREAKLINE

Lastlight 同宇宙的短篇縱向卷軸射擊冒險。你駕駛一架裝上古文明核心的拼裝戰機：接住敵方的能源砲火，轉成自己的反擊武器，替撤離船打開 Helion 的封鎖線。

> **狀態：Phase 1 戰鬥原型。** 可以玩一場約 70 秒的測試場地，內容包括吸收、衝刺、反擊、能源與熱量，以及兩種敵機和兩種子彈。另有關閉核心的對照組可做 A/B 測試。設計文件見 [`docs/Breakline_Game_Plan_v0.1.txt`](docs/Breakline_Game_Plan_v0.1.txt)。

## Run Locally

```bash
npm install
npm run dev
```

## Controls

| Action | Key | Touch |
|---|---|---|
| Move | Arrow Keys / WASD | Drag |
| Fire | 自動 | 自動 |
| Absorb（吸收窗口 0.6s） | Shift | ABSORB 按鈕 |
| Dash（衝刺） | Space | DASH 按鈕 |
| Counter（反擊，30 能源） | E / C | COUNTER 按鈕 |
| Pause | P / Esc | 點擊畫面 |
| Mute | M | 🔊 |
| Settings（音樂 / 音效音量） | 首頁按 O | 首頁 SETTINGS 按鈕 |

## 核心玩法

| | 外觀 | 吸收 | 衝刺 | 普通射擊 |
|---|---|---|---|---|
| **能源彈** | 青色空心圓環 | ✅ 機首前方 100° 扇形內 | 可穿越 | — |
| **飛彈** | 橙紅色箭頭＋警示光暈 | ❌ | 可穿越 | 一發擊落 |
| **敵機機體** | — | — | ❌ 撞上即死 | — |

- **吸收**：按 Shift 打開 0.6 秒窗口，結束後冷卻 1.2 秒。窗口期間普通射擊暫停。和機身同高或在側面、後方的子彈照樣致命。
- **能源與熱量**：每接一顆能源彈 +8 能源、+7 熱量；每次打開窗口另加 10 熱量。停止吸收 0.5 秒後開始散熱。過熱只鎖住吸收，射擊和衝刺照常可用，熱量降到 35 以下就解鎖。
- **反擊**：花 30 能源釋放全畫面衝擊波，效果同 neon-raiden 的炸彈：清掉畫面上所有能源彈、擊落所有飛彈，畫面上每台敵機受 10 點傷害，Boss 受最大 HP 8% 的傷害。冷卻 0.8 秒。
- **衝刺**：0.2 秒內移動 150px，冷卻 2 秒，會取消正在開啟的吸收窗口。

所有數值都在 [`src/game/data/core.ts`](src/game/data/core.ts)。

## 試玩測試（規劃書第十四節）

標題畫面有兩個選項：**START**（核心開啟）和 **CONTROL RUN**（核心關閉，按 2）。兩者用同一個場地，可以讓受測者交替順序各玩一次。

每局結束後，畫面會顯示測試報告，**COPY RESULT** 可以把報告複製成 JSON。報告包含：

- 吸收窗口次數，其中沒接到任何子彈的次數
- 接到的子彈數
- 反擊次數，以及反擊擊殺數
- 過熱次數和鎖住的時間
- 反擊可用卻沒有使用的時間
- 衝刺次數
- 死因分佈，以及吸收期間的死亡次數

## 從 neon-raiden 沿用的部分

- Pixi.js v8 渲染、bloom 後處理、landscape 中央 combat corridor 版面
- 子彈、敵機、爆炸、gem、pickup、浮動文字的物件池
- 資料化的波次系統、3 階段 Boss（原本三關留在 `LEGACY_STAGES`，供 Phase 2–3 參考）
- 極座標彈幕產生器（ring / spiral / flower / aimed-fan）
- 音效 / BGM 系統
- Shockwave、Hitstop、ScreenShake 等打擊演出（現在用在反擊）

## Roadmap

1. ~~**Phase 1 戰鬥原型**~~：已完成，等待試玩驗證
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
