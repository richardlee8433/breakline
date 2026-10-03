# CLAUDE.md — BREAKLINE

## Project overview

Lastlight 同宇宙的短篇縱向卷軸射擊冒險。核心玩法：**吸收 → 火力與護盾**。接住敵方能源彈存成能源，能源同時決定主炮等級和護盾層數。炸彈則由敵機掉落。

- 完整設計：[`docs/Breakline_Game_Plan_v0.1.txt`](docs/Breakline_Game_Plan_v0.1.txt)。名稱、數值、劇情都是暫定。
- 程式碼從 [neon-raiden](https://github.com/richardlee8433/neon-raiden) fork 出來，渲染、物件池、波次、Boss、音訊都沿用它的基礎。
- **目前狀態：Phase 1 戰鬥原型已完成，等待試玩驗證。**
  - 兩種模式（`mode`）：
    - **story**：三關故事模式，每關前播對話（`STORY_STAGES`），打完播結局。
    - **arena**：約 70 秒的戰鬥測試場地（`ARENA`）。
  - 兩種模式都透過 `stageConfig(mode, stage)` 取得關卡設定。
  - 已移除的系統：BURST、炸彈、VIVERSE 排行榜、Laser / Plasma、武器等級、focus。
  - 保留下來給街機模式用的：graze、chain、無限循環。

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
    core/GameApp.ts       # Pixi Application、主 ticker、能力調度、試玩數據、提示
    data/
      core.ts             # 吸收 / 能源（等級、護盾）/ 熱量 / 衝刺 / 炸彈的所有數值
      player.ts           # 移動速度、自動射擊、重生
      enemies.ts          # 敵機屬性表（含 bulletKind: energy | missile）
      stages.ts           # ARENA、STORY_STAGES、stageConfig()
      story.ts            # 故事模式台詞與角色（全部暫定）
      audio.ts            # 音效清單
    entities/             # Player（含衝刺）, Enemy（HostilePools）, Boss, BulletPool, Pickup, Gem
    systems/
      CoreSystem.ts       # 能源→等級與護盾、熱量、過熱、吸收窗口與冷卻、試玩計數
      CollisionSystem.ts  # absorb() 先跑、check() 後跑；damageEnemy / damageBoss 共用擊殺流程
      Input / Wave / Drop / BulletPatterns / Scroll / Audio / Music / SampleBank
    fx/
      AbsorbField.ts      # 吸收扇形（畫面與判定共用 contains()）、接彈收束動畫
      Explosion, Shockwave, Hitstop, ScreenShake, FloatingText, GlowTexture, ...
  store/gameStore.ts      # Zustand：score, lives, phase, core（HUD 鏡像）, hint, report, coreEnabled
  ui/                     # HUD, CorePanel（能源 / 熱量 / 冷卻）, TitleScreen（A/B）, GameOverScreen（試玩報告）
  assets/AssetLoader.ts   # 用 HTMLImageElement 載入貼圖（不用 Assets.load，見檔內註解）
public/assets/            # 所有圖片與音訊，不要放進 src/
docs/                     # 設計文件
```

## Architecture rules

### Game loop
- 遊戲邏輯全部在 Pixi ticker 內跑。React 只負責 overlay，透過 Zustand 訂閱更新。
- ticker 內讀寫 store 一律用 `gameStore.getState()`，不要碰 React state。
- 每幀寫 store 會讓 HUD 跟著 re-render。連續變化的值要批次寫入。參考 `GameApp.syncCore`：最高 20 Hz、沒變化就不寫，只有接彈和狀態翻轉會立刻寫。
- 計時用 ticker 的 `dt`，不要用 `setTimeout` / `setInterval`。

### Tick 順序（GameApp.tick）
1. 讀輸入，對 absorb / dash / bomb 做 edge detect。換關時三者都預設為「按住中」，避免開局那一下 Space 直接觸發衝刺。
2. 衝刺（會取消吸收）→ 開啟吸收 → `player.update(…, core.level)` → `core.update` → 炸彈。
3. 子彈和敵機移動 → **`collision.absorb()`** → **`collision.check()`**。順序很重要：同一顆子彈只會有一個結果。

### Object pooling（強制）
- 子彈、敵機、爆炸、gem、pickup、浮動文字、衝刺殘影都走 pool，ticker 內不要 `new` 遊戲物件。
- 熱迴圈直接迭代 `pool.all` / `waves.enemies`，跳過 inactive 的，不要每幀 `filter` 出新陣列。
- 回收用 `pool.release(obj)`；換關時 `releaseAll()`。

### Data
- 速度、HP、傷害、冷卻、窗口時間等數值集中在 `src/game/data/`，class 裡不寫死。

### Collision
- 用 AABB，以純量比較，不配置 `Rectangle`。玩家 hitbox 很小（6px × SPRITE_SCALE）。
- 子彈種類由「放在哪個 pool」決定，不靠 per-bullet 旗標：
  - `enemyBullets` / `bossBullets` 是能源彈（可吸收）。
  - `missiles` 是飛彈（不可吸收，普通射擊可以擊落）。

## Breakline 戰鬥規則

詳見設計文件第四、十二節。以下是已實作的規則，改動時要守住：

- **吸收**：按下觸發，窗口 0.6s、冷卻 1.2s，不能按住。判定範圍是機首前方扇形：頂點在機身中心，半角 50°，半徑 105。和機身同高、在側面或後方的子彈**照樣致命**。吸收中暫停普通射擊；衝刺會取消吸收。
- **能源 / 熱量**：各 0–100。接到彈會同時加能源和熱量，開窗口也會加熱量。停止吸收後才開始散熱。過熱只鎖住吸收，不扣血，射擊和衝刺照常能用。
- **能源 → 火力與護盾**：每 `ENERGY.perLevel`（20）能源等於一級火力（`PLAYER.shotPattern[level]`）加一層護盾。
  - `Player.hit()` 會先問 `shieldHook`；有護盾時改由 `GameApp.onShieldHit` 扣一層（`core.breakShield`），給無敵並清掉附近子彈，玩家不會死。
  - 死亡時呼叫 `core.onDeath()`，能源歸零。
- **炸彈**：存量在 store 的 `bombs`，0 到 3。
  - 掉落：`DropSystem.spawnEnemyDrop`，機率掉落，加上 `BOMB.pityKills` 保底；換局時 `resetDrops()`。
  - 效果：`GameApp.fireBomb`，全畫面衝擊波。清空所有能源彈、擊落所有飛彈；畫面內每台敵機受一次傷害，畫面外排隊的不算；Boss 受最大 HP 8% 的傷害。
- **教學對話（talk）**：store 的 `talk` 是戰鬥中的對話。
  - 有 talk 時 GameApp 不 tick 戰鬥、HUD 淡出；結束後三個動作鍵都視為「按住中」，避免用來翻頁的那一下觸發衝刺或炸彈。
  - 觸發點：`trackRun()`，第一次出現能源彈時；`onBombFound()`，第一次撿到炸彈時。只在故事模式觸發，每局一次。
- **衝刺**：0.2s、冷卻 2s。可以穿越子彈和飛彈，但**不能**穿越敵機機體和光束（Gunship 雷射）。
- **Boss 部件**（Phase 2）：每個部件有獨立的 hitbox 和 HP。部件被摧毀時，碰撞和發射**要同時關閉**。
- **換關清理**：`startStage` 重置能力狀態、敵彈、提示、試玩數據，不能殘留。

`InputSystem` 對外只輸出統一的 `Actions`，不讓外部直接讀 keyCode。觸控按鈕用 `tapKey()` 走同一條 key path。

## 故事模式流程

```
title → story(stage1) → playing → [Boss 擊破] stageclear → (2.5s, ticker 計時)
      → story(stage2) → playing → … → story(ending) → complete
gameover → RETRY STAGE → playing（同一關，不重播對話）
```

- **store**：
  - `startRun(mode, core)`、`playScene(id)`、`finishScene()`、`retryStage()`。
  - `phase === 'story'` 時，GameApp 不 tick 戰鬥。
- **GameApp**：
  - 任何從非 playing 進入 playing 的轉換都會呼叫 `startStage`。
  - 進入 story 時呼叫 `enterStory()`，負責清場並換上下一關的背景。
- **對話 UI**：`ui/StoryDialog.tsx`，移植自 Lastlight 的 `Dialog.tsx` 和 `.dlg` CSS，尺寸乘上 `--k`（= SPRITE_SCALE）。
- **立繪**：`portraitURL(id)`（`src/art/portraits.ts`），規則同 Lastlight 的 portraitArt。
  - 有手繪圖的角色，用 `public/assets/portraits/<id>.webp`，從第一版四人合圖切出的胸像，透明背景、底部淡出。這是暫用素材，`docs/characters.md` 規劃之後改用獨立立繪。
  - 沒有手繪圖的角色，退回移植自 Lastlight 的像素立繪引擎（`.dlg-art.pixel`）。
  - 新增手繪角色時，把 id 加進 `HAND_DRAWN`。
  - 正式角色：凱・默瑟（kai）、蘿莎・維加（rosa）、米拉・森博士（mira）、沃斯指揮官（voss）。
- **試玩數據**：故事模式三關累計。從標題開始新的一局時才重置。

## 試玩支援（規劃書第十四節）

- 標題畫面按 1 或 Space 進故事模式，按 2 進 ARENA。
- 按 3 是對照組（ARENA 加上 `coreEnabled = false`）。
- 每局結束時，`GameApp.finishRun()` 產生 `RunReport`，結算畫面會顯示，並可複製成 JSON。
- 教學提示是非阻擋式的 banner，每局各觸發一次。觸發點在 `GameApp.trackRun()`。

## 驗證遊戲邏輯的方法

headless Chromium 沒有 GPU，FPS 量不準。比較可靠的方法是：

1. 暫時在 `App.tsx` 加上 `window.__game = game`（**不要 commit**）。
2. 停掉 ticker：`__game.app.ticker.stop()`。
3. 用 `__game.tick(1/60)` 逐幀推進，配合 dispatch `KeyboardEvent` 操作，再檢查 `__game.core` / `__game.player` 的狀態。

規則類的改動（扇形判定、衝刺免疫等）都應該用這個方法跑過。

## 開發階段

- **Phase 1 戰鬥原型**（完成，待試玩）：測試場地、巡邏無人機（能源彈）、飛彈攔截機，加上自動射擊、衝刺、吸收（升級火力、護盾）、掉落炸彈。
- **Phase 2**：完整第一關。內容包括教學、短通訊、有兩個可拆炮塔的 Boss、失敗重試。
- **Phase 3**：三關故事版，含三台 Boss、開場、結局、關卡解鎖。
- **Phase 4**：打磨。包括手機操作、輔助難度、街機模式和排行榜。

## Known debt

- 規劃書要求「首次教學在安全區暫停或減速」，目前只有非阻擋式提示。
- 音效是從現有素材挑的，還沒實際聽過調整：吸收用 `graze-alt` / `gem-alt`，升級用 `pickup-alt`，護盾破裂用 `explosion1`（加速），炸彈用 `bigshot3` + `explosion3`，過熱用 `alarm1`，衝刺用 `smallshot5`。
- `public/assets` 裡還留著 neon-raiden 沒在用的素材：power、laser、plasma 的 pickup 圖和音效。

## Don't
- 不要在 update loop 裡 `console.log`。
- 不要為了相容 neon-raiden 而保留已確定不用的系統。這是獨立的遊戲。
- 第一版不做這些：開放世界、基地建設、多人、完整裝備樹、每日營運活動（設計文件第十五節）。
