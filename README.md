# BREAKLINE

Lastlight 同宇宙的短篇縱向卷軸射擊冒險。你駕駛一架裝上古文明核心的拼裝戰機：接住敵方的能源砲火，轉成自己的火力與護盾，替撤離船打開 Helion 的封鎖線。

> **狀態：Phase 1 戰鬥原型＋故事模式草稿。** 有三種玩法：
> - **STORY**：三關故事模式，每關開始前有劇情對話，打完三關播結局。
> - **ARENA**：約 70 秒的戰鬥測試場地。
> - **CONTROL RUN**：關閉核心的對照組，用於 A/B 測試。
>
> 角色、台詞、地名都是暫定。設計文件見 [`docs/Breakline_Game_Plan_v0.1.txt`](docs/Breakline_Game_Plan_v0.1.txt)。

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
| Bomb（炸彈，敵機掉落） | E / C | BOMB 按鈕（持有時出現） |
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
- **能源 → 火力與護盾**：每接一顆能源彈 +5 能源。**每 20 能源 = 一級火力 + 一層護盾**。
  - 火力從 LV1 的 1 發，到 LV5 的 5 發。
  - 被打中時由護盾擋下，扣 20 能源（掉一級火力）並無敵 1.2 秒，附近的子彈也會一起清掉。
  - 能源不到 20 時被打中才會死，死亡時能源歸零。
- **熱量**：每接一顆 +7 熱量；每次打開窗口另加 10 熱量。
  - 停止吸收 0.5 秒後開始散熱。
  - 過熱只鎖住吸收，射擊和衝刺照常可用；熱量降到 35 以下就解鎖。
- **炸彈**：由敵機掉落。開局 0 顆，最多 3 顆。
  - 掉落率 4%；一局中如果到第 12 次擊殺都還沒掉過，就保證掉一顆。
  - 按 E 釋放全畫面衝擊波：清掉所有能源彈、擊落所有飛彈，畫面上每台敵機受 10 點傷害，Boss 受最大 HP 8% 的傷害。
  - 冷卻 0.8 秒。
- **衝刺**：0.2 秒內移動 150px，冷卻 2 秒，會取消正在開啟的吸收窗口。

所有數值都在 [`src/game/data/core.ts`](src/game/data/core.ts)。

## 故事模式

標題畫面選 **STORY**（按 1 或 Space）。

- **對話**：每關開始前播一段簡報。對話框沿用 Lastlight 的樣式：像素半身立繪、名牌、逐字打字。
  - Space、Enter 或點擊：先把這句打完，再按一次翻下一句。
  - 「跳過」或 Esc：跳過整段對話。
- **失敗**：game over 時可以選 **RETRY STAGE** 重打當關，不會重播簡報。
- **工程師教學**：故事模式中，蘿莎會在兩個時機暫停戰鬥、用對話說明。
  - 第一次出現能源彈時：說明怎麼吸收，以及能量會升級火力、撐起護盾。
  - 第一次撿到炸彈時：說明炸彈。
  - ARENA 則維持不打斷遊戲的提示條。

| 關卡 | 內容 | Boss（暫用 neon-raiden 的圖） |
|---|---|---|
| 1 · 突破巡邏線 | 無人機吸收教學 → 飛彈對比 → 混合 | Helion 攔截艦 |
| 2 · 遺跡捷徑 | 原第二關敵群＋飛彈攔截機 | 古文明守衛 |
| 3 · 打開封鎖線 | 原第三關敵群＋飛彈攔截機 | Helion 封鎖旗艦 |

暫定角色：
- **凱**：飛行員。
- **蘿莎**：工程師。
- **諾娃博士**：研究員。
- **哈爾特司令**：Helion 封鎖艦隊指揮官。

立繪是用 Lastlight 的像素立繪產生器畫的暫代圖（`src/art/portraits.ts`），台詞在 `src/game/data/story.ts`。

## 試玩測試（規劃書第十四節）

標題畫面的 **ARENA**（按 2）和 **CONTROL RUN**（核心關閉，按 3）用同一個場地，可以讓受測者交替順序各玩一次。

每局結束後，畫面會顯示測試報告，**COPY RESULT** 可以把報告複製成 JSON。報告包含：

- 吸收窗口次數，其中沒接到任何子彈的次數
- 接到的子彈數
- 最高火力等級、護盾擋下的次數
- 炸彈撿到 / 使用次數，以及炸彈擊殺數
- 過熱次數和鎖住的時間
- 衝刺次數
- 死因分佈，以及吸收期間的死亡次數

## 從 neon-raiden 沿用的部分

- Pixi.js v8 渲染、bloom 後處理、landscape 中央 combat corridor 版面
- 子彈、敵機、爆炸、gem、pickup、浮動文字的物件池
- 資料化的波次系統、3 階段 Boss（故事模式第二、三關沿用原本的關卡，並加入飛彈攔截機）
- 極座標彈幕產生器（ring / spiral / flower / aimed-fan）
- 音效 / BGM 系統
- Shockwave、Hitstop、ScreenShake 等打擊演出（現在用在炸彈）

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
