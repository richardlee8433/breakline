# CLAUDE.md — BREAKLINE

## Project overview

Lastlight 同宇宙的短篇縱向卷軸射擊冒險。核心玩法：**吸收 → 轉化 → 反擊**，也就是接住敵方能源彈，存成能源，再釋放成反擊武器。

- 完整設計：[`docs/Breakline_Game_Plan_v0.1.txt`](docs/Breakline_Game_Plan_v0.1.txt)。名稱、數值、劇情都是暫定。
- 程式碼從 [neon-raiden](https://github.com/richardlee8433/neon-raiden) fork 出來，渲染、物件池、波次、Boss、音訊都沿用它的基礎。
- BURST、炸彈、VIVERSE 排行榜已移除。武器三選一（Vulcan / Laser / Plasma）、graze、focus、無限循環**還留著**，由 Phase 1 決定去留。

## Tech stack

React 19 + Vite 6、Pixi.js v8（pixi-filters bloom）、Zustand 5、TypeScript 5.6。素材是 Kenney Pixel Shmup（CC0），另有自製機體、敵機、背景圖。

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build；commit 前必跑
```

目前沒有測試框架和 lint。改完至少跑 `npm run build`，有動到遊戲邏輯就實際開瀏覽器玩一輪。

## Folder structure

```
src/
  game/
    config.ts             # 畫面尺寸、combat corridor、SPRITE_SCALE（載入時算一次）
    core/GameApp.ts       # Pixi Application、主 ticker、關卡切換、死亡處理
    data/                 # 所有可調數值：stages / enemies / audio
    entities/             # Player, Enemy, Boss, BulletPool, Pickup, Gem
    systems/              # Input, Collision, Wave, Drop, BulletPatterns, Scroll, Audio, Music, SampleBank
    fx/                   # Explosion, Shockwave, Hitstop, ScreenShake, LaserBeam, FloatingText, ...
  store/gameStore.ts      # Zustand：score, chain, lives, weapon, stage, loop, phase, boss HP
  ui/                     # React overlay：HUD, TitleScreen, GameOverScreen, StageClear, StageAnnouncement
  assets/AssetLoader.ts   # 用 HTMLImageElement 載入貼圖（不用 Assets.load，見檔內註解）
public/assets/            # 所有圖片與音訊，不要放進 src/
docs/                     # 設計文件
```

## Architecture rules

### Game loop
- 遊戲邏輯全部在 Pixi ticker 內跑。React 只負責 overlay，透過 Zustand 訂閱更新。
- ticker 內讀寫 store 一律用 `gameStore.getState()`，不要碰 React state。
- 每幀寫 store 會讓 HUD 跟著 re-render。像能源、熱量這種連續變化的值，要批次寫入（例如 20 Hz）或只在跨過門檻時寫。
- 計時用 ticker 的 `dt`，不要用 `setTimeout` / `setInterval`。

### Object pooling（強制）
- 子彈、敵機、爆炸、gem、pickup、浮動文字都走 pool，ticker 內不要 `new` 遊戲物件。
- 回收用 `pool.release(obj)`；換關時 `releaseAll()`。

### Data
- 速度、HP、傷害、冷卻、窗口時間等數值集中在 `src/game/data/`，class 裡不寫死。
- Breakline 新增的能源、熱量、吸收、衝刺、反擊參數放在獨立的 data 檔（例如 `data/core.ts`），方便快速調整。

### Collision
- 用 AABB。玩家 hitbox 很小（6px × SPRITE_SCALE），比 sprite 小很多。

## Breakline 戰鬥規則（Phase 1 要實作的部分）

詳細內容在設計文件第四、十二節，這裡只列會直接影響程式結構的約束：

- **Player 動作狀態**：`normal | absorbing | dashing | overheated | hit`，加上既有的 `dead | respawning`。
- **吸收**：按下觸發，窗口 0.6s、冷卻 1.2s，不能按住。判定範圍是機首前方扇形，側面和後方照樣會被打中。吸收中暫停普通射擊；衝刺會取消吸收。
- **衝刺**：0.2s、冷卻 2s。可以穿越一般彈幕，但不能穿越船體、障礙物和特殊持續光束（例如 Gunship 雷射）。
- **能源 / 熱量**：各 0–100。成功吸收時能源和熱量都增加，之後熱量逐步散掉。過熱只停用吸收，不扣血，射擊和衝刺照常能用。
- **反擊**：固定門檻（暫定 30 能源），第一版只有「脈衝反擊」：前方穿透炮。清彈、Shockwave、Hitstop 等演出直接重用 `fx/`。
- **子彈類型**：BulletPool 的子彈要帶 `absorbable` 屬性。可吸收的是青色、圓形、空心輪廓；不可吸收的是橙紅色實體飛彈或箭頭輪廓。不能只靠顏色區分，形狀和音效也要不同。
- **同一顆子彈只處理一次**：碰撞順序是先判定吸收，再判定受傷。吸收成功的子彈要當幀 release，不能再觸發受傷。
- **Boss 部件**：每個部件有獨立的 hitbox 和 HP。部件被摧毀時，碰撞和發射**要同時關閉**。
- **換關清理**：能力狀態、敵彈、任務物件全部重置，不能殘留。

### 目標操作（桌面）
| 動作 | 鍵 |
|---|---|
| 移動 | 方向鍵 / WASD |
| 普通射擊 | 自動 |
| 吸收 | Shift |
| 衝刺 | Space |
| 反擊 | E / C |
| 暫停 | Esc / P |

`InputSystem` 對外只輸出統一的 `Actions`，不讓外部直接讀 keyCode。觸控按鈕走同一條 key path。

## 開發階段

- **Phase 1 戰鬥原型**（目前）：一個測試場地，一種能源彈敵人，一種實體飛彈敵人，加上自動射擊、衝刺、吸收、脈衝反擊。
  不做的部分：劇情、正式美術、多武器、成長系統、手機最佳化。
- **Phase 2**：完整第一關。內容包括教學、短通訊、有兩個可拆炮塔的 Boss、失敗重試。
- **Phase 3**：三關故事版，含三台 Boss、開場、結局、關卡解鎖。
- **Phase 4**：打磨。包括手機操作、輔助難度、街機模式和排行榜。

## Known debt（繼承自 neon-raiden）

- `GameApp.handleStageClear` 用 `setTimeout` 做關卡過場，應改成 ticker 計時。
- `CollisionSystem` 是全體配對，而且每幀每顆子彈都 `new Rectangle`，`Player.hitboxWorld` 也一樣。加入吸收判定前先改成重用物件。
- `Player.ts` 的速度、射速、彈型寫死在檔案頂部，應搬進 `data/`。
- `public/assets` 裡還留著 neon-raiden 的炸彈 pickup 圖和音效，目前沒有使用。

## Don't
- 不要在 update loop 裡 `console.log`。
- 不要為了相容 neon-raiden 而保留已確定不用的系統。這是獨立的遊戲。
- 第一版不做這些：開放世界、基地建設、多人、完整裝備樹、每日營運活動（設計文件第十五節）。
