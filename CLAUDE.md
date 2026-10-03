# CLAUDE.md — BREAKLINE

## Project overview

Lastlight 同宇宙的短篇縱向**追逐逃生**。玩家護送撤離船，追兵只從後方來。核心玩法是**移動＋EMP**：常駐吸收場自動吸能源彈充能，滿了就放 EMP 讓追兵熄火，撐到關卡時間結束。不要求擊殺。

- 現行設計：[`docs/Breakline_Chase_Prototype_Design_v0.2.txt`](docs/Breakline_Chase_Prototype_Design_v0.2.txt)。
- 舊的規劃書 [`docs/Breakline_Game_Plan_v0.1.txt`](docs/Breakline_Game_Plan_v0.1.txt) 只作為世界觀參考。玩法以 v0.2 為準。
- 改版前的「吸收射擊」版本保留在 tag `v0.1-absorb-shooter`。
- 程式碼從 [neon-raiden](https://github.com/richardlee8433/neon-raiden) fork 出來。
- **目前狀態：Phase A–C 已完成。** 三關都可以玩，包含跳躍和結局。接下來是 Phase D：試玩調整。
  - 2026-10-03 已確定的決策：
    - 能源彈完全無害。
    - 主角在畫面中上方移動。
    - 觸控採相對拖曳。
    - 原型時長為 2 / 3 / 4 分鐘。
    - 戰鬥中只用不擋畫面的短句通訊。唯一例外是第三關第一次遇到水雷時，暫停一次由角色說明。

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
    config.ts             # 畫面尺寸、combat corridor、SPRITE_SCALE、TIME_SCALE（?time=）
    core/GameApp.ts       # Pixi Application、主 ticker、關卡計時、EMP、受傷、短句通訊、試玩報告
    data/
      chase.ts            # 玩家活動帶、吸收場、能量、EMP、耐久、追兵行為的所有數值
      enemies.ts          # 追兵屬性表（attack: fan = 能源彈 | missile = 鎖定後發射飛彈 | guided = 制導飛彈）
      stages.ts           # 三關：追兵波次、小行星區段（rocks）、水雷波次（mines）、jump / finale
      story.ts            # 三關開場與結局台詞（v0.2 劇本）
      audio.ts            # 音效清單
    entities/             # Player（耐久、活動帶）、Enemy（追兵狀態機）、BulletPool
    systems/
      CoreSystem.ts       # 能量入帳（每秒上限）、EMP 就緒與間隔、試玩計數
      CollisionSystem.ts  # absorb() 先跑、check() 後跑
      WaveSystem.ts       # 依時間軸從下緣放出追兵；追兵之間有側向分離
      HazardSystem.ts     # 前方地形：小行星列（保證通道）、水雷狀態機、上緣預告標記
      Input / Scroll / Audio / Music / SampleBank / BulletPatterns
    fx/                   # AbsorbField（圓形場）、Shockwave（EMP）、Explosion、EngineExhaust、FloatingText...
  store/gameStore.ts      # Zustand：phase, stage, hull, timeLeft, core（HUD 鏡像）, hint, report
  ui/                     # HUD, EmpPanel, PauseMenu, TitleScreen, ResultScreen（過關 / 失敗 / 完結）, StoryDialog, SettingsPanel
  art/portraits.ts        # 對話立繪（手繪胸像 + 像素後備）
public/assets/            # 所有圖片與音訊，不要放進 src/
docs/                     # 設計文件、角色設定
```

## Architecture rules

### Game loop
- 遊戲邏輯全部在 Pixi ticker 內跑。React 只負責 overlay，透過 Zustand 訂閱更新。
- ticker 內讀寫 store 一律用 `gameStore.getState()`，不要碰 React state。
- 連續變化的值要批次寫入 store。參考 `GameApp.syncCore`：最高 20 Hz、沒變化就不寫。吸到能源彈、READY 狀態翻轉時才立刻寫。
- `setClock` / `setHull` 沒變化時回傳原 state，不觸發 re-render。
- 計時用 ticker 的 `dt`，不要用 `setTimeout` / `setInterval`。

### Tick 順序（GameApp.tick）
1. 暫停時整個停住。對話中、非 playing 時只捲背景、跑特效。
2. 死亡演出中（`deathTimer`）：只讓場面繼續動，時間到後進 gameover。
3. **先推進關卡時鐘。時間到就過關並 return**：同一幀「到時」優先於「被撞」。
4. 讀輸入，對 EMP 做 edge detect（按住不會自動連發）→ `player.update` → `core.update` → EMP。
5. 制導飛彈轉向 → 子彈移動 → `waves.update`（回傳本幀甩脫數）→ **`collision.absorb()`** → **`collision.check()`** → `hazards.update`（小行星碰撞、水雷）→ 處理 `player.lastHit`。
6. 跳躍演出中（`jumpTimer`，只有第三關）：不做任何傷害判定，演完進結局（故事）或結算（試玩）。

### Object pooling（強制）
- 子彈、追兵、爆炸、浮動文字、吸收動畫都走 pool，ticker 內不要 `new` 遊戲物件。
- 熱迴圈直接迭代 `pool.all` / `waves.enemies`，跳過 inactive 的。
- 回收用 `pool.release(obj)`；換關時 `releaseAll()` / `dismissAll()`。

### Data
- 速度、時間、半徑、冷卻等數值集中在 `src/game/data/`，class 裡不寫死。

### Collision
- 只有玩家會受傷，所以每項檢查都是「玩家 vs 一個清單」，線性，不做兩兩配對。
- 用 AABB 純量比較，不配置 `Rectangle`。玩家受傷判定很小（6px × SPRITE_SCALE）。
- 子彈種類由「放在哪個 pool」決定：
  - `energy` 是能源彈（無害，被吸收）。
  - `missiles` 是飛彈（扣耐久）。

## 追逐規則（v0.2，改動時要守住）

- **活動帶**：玩家只在 `PLAYER.bandTop`–`bandBottom`（畫面高度 15%–58%）之間移動。下方是追兵進場和排隊的空間。
- **追兵**：
  - 只從下緣進場，進場前先有 `CHASE.warnTime`（0.8 秒）預警標記。
  - 狀態機：`warn → chase → (dark) → leave`。
  - 永遠待在玩家下方至少 `CHASE.minGap`，不會越過玩家。
  - 到站後才開始攻擊。超過 `chaseTime` 會自己退場。
- **吸收場**：圓形，半徑是機身寬 × `FIELD.radiusFactor`，比受傷判定大。所以**能源彈永遠先碰到吸收場，不可能造成傷害**。
  - 能量每秒入帳上限 `ENERGY.capPerSec`（token bucket）。超過上限或能量已滿時，照樣吸收，只是不存。
- **EMP**：
  - 需要能量全滿，並距離上次至少 `EMP.cooldown` 秒。釋放時用掉整條能量。
  - 範圍內 `empable` 的追兵進入 `dark`：不開火、不追、沒有撞擊傷害，往後漂。漂出下緣算甩脫。
  - 範圍內的能源彈和飛彈清除。範圍外不受影響。不給玩家無敵。
- **耐久與生命**：
  - 每關、每條命都有 `HULL.max` 格耐久。被打中後無敵 `HULL.iframes` 秒。
  - 耐久歸零就扣一條命（store 的 `lives`，每一輪從 `LIVES.start` 開始），播 `HULL.deathBeat` 秒的演出（期間計時暫停），然後原地 `respawn()`。命用完才進 gameover。
  - GAME OVER 後的 retry 會把命補回 `LIVES.start`。暫停選單的重來和過關後的 retry，會回到 `livesAtStage`。
  - gameover 的說明文字依最後一擊的原因（`report.fatal`）顯示。
- **分數**：過關時才計分，公式是「完整度 % × `SCORE.perIntegrityPct` + 剩餘生命 × `SCORE.perLife`」，存在 `stageScores`。結算畫面只顯示分數，完整數據收在 COPY PLAYTEST DATA。
- **飛彈**：先鎖定（`LOCK.time`，有鎖定框和警示音），再朝玩家當下的位置發射。
  - 制導飛彈（粉紅色）的轉向速度有上限（`GUIDED.turnRate`），`GUIDED.life` 秒後熄火。
- **小行星**：連續隨機的岩塊場，不分列。
  - 出現時機用抖動的固定間隔：平均間隔 1/`rate`，再加減 40%。純 Poisson 計時會忽多忽少，所以不用。
  - 位置用 best-candidate 取樣（Mitchell 演算法）：每顆試 12 個隨機位置，取離現有岩塊最遠的那個。與其他岩塊至少相距 `ROCK_SPACING`，找不到合格位置就放棄這顆。
  - 安全通道：中心線是 1D value noise。每 1.2 秒一個隨機控制點，相鄰兩點差距不超過 `wander`×1.2，中間用 smoothstep 平滑。岩塊在自身整個高度內都不能進入寬度 `gap` 的通道。`gap` 約為機身寬的 2.3–2.7 倍。
  - 所有岩塊都以同一速度、從同一條起始線（`ROCK_Y0`）落下，整片岩塊場是一個剛體，所以可以用進場時間代表高度。要改成每顆不同速度，就得一起改這套檢查。
  - 均勻度量測（2026-10-03，手機，第二關跑 3 次）：
    - 畫面格子分布的 CV 從 1.05 降到 0.75。
    - 同屏數量的 CV 從 0.24 降到 0.20。
    - 0 幀被堵、0 對岩塊重疊。
  - 碰到扣 1 格，岩石不會消失。
- **追兵與地形**（`HazardSystem.steerPursuers`，在 collision 之後呼叫）：
  - 動力中的追兵：挑最緊急的岩塊或水雷，往有空的一側閃，並把站位一起移過去。正面迎上時先往後讓。萬一還是太近，會被推出岩塊邊緣，所以不會穿過或撞上岩塊。
  - 熄火（EMP）的追兵沒有推力，在畫面內碰到岩塊就撞毀，計入報告的 `wrecked`。
  - 水雷不會因追兵引爆，追兵也會閃開水雷。
  - 量測結果：動力中的追兵撞毀 0 次；與岩塊重疊的幀數從約 8,800 降到 0–5。
- **水雷**：狀態是 `idle → armed → blast`。
  - 進入 `triggerRadius` 就點燃 1 秒引信，離開也不會取消。
  - 爆炸只在引爆那一幀判定一次，範圍是 `blastRadius`。
  - EMP 不影響水雷，也沒有連鎖爆炸。
- **預告**：小行星和水雷都會先在上緣顯示標記（`ROCK.preview` / `MINE.preview`），再進場。
- **重來**：從暫停選單重來時，`phase` 仍是 playing，所以靠 `runSerial` 遞增觸發 `startStage`。
- **計時**：只在追逐實際進行時累積。對話、暫停、切換分頁（自動暫停）都不計時。
- **短句通訊**：用 `GameApp.say()` 在 HUD 頂端顯示，每局各一次，不暫停遊戲。

`InputSystem` 對外只輸出統一的 `Actions`，不讓外部直接讀 keyCode。觸控的 EMP 按鈕用 `tapKey()` 走同一條 key path。

## 故事模式流程

```
title → story(stage1) → playing → [時間到] stageclear（結果畫面）→ CONTINUE
      → story(stage2) → … → story(ending) → complete
gameover → RETRY（同一關，不重播對話）或 BRIEFING（重看開場）
```

- 第三關結束時不經過 stageclear：先播跳躍演出，再直接進 `ending`。結局之後的 complete 畫面會顯示第三關的報告。
- **store**：
  - `startRun(mode)`，mode 是 `'story' | 'trial'`。
  - 其他動作：`playScene(id)`、`finishScene()`、`retryStage()`、`continueRun()`、`autoPause()`。
- **GameApp**：
  - 任何從非 playing 進入 playing 的轉換都會呼叫 `startStage`，重置耐久、能量、計時、波次。
  - 進入 story 時呼叫 `enterStory()`。
- **talk**：戰鬥中暫停用的對話，目前只有 `tut-mine`（故事模式中第一顆水雷完整進入畫面時）。試玩模式改用短句通訊。
- **對話 UI**：`ui/StoryDialog.tsx`，移植自 Lastlight 的 `Dialog.tsx` 和 `.dlg` CSS，尺寸乘上 `--k`（= SPRITE_SCALE）。
- **立繪**：`portraitURL(id)`（`src/art/portraits.ts`），規則同 Lastlight 的 portraitArt。
  - 有手繪圖的角色，用 `public/assets/portraits/<id>.webp`，從四人合圖切出的胸像，透明背景、底部淡出。這就是正式立繪。
  - 沒有手繪圖的角色，退回移植自 Lastlight 的像素立繪引擎（`.dlg-art.pixel`）。
  - 新增手繪角色時，把 id 加進 `HAND_DRAWN`。
  - 正式角色：凱・默瑟（kai）、蘿莎・維加（rosa）、米拉・森博士（mira）、艾德里安・索恩指揮官（thorne）。
  - 寫台詞照 `docs/characters.md` 的分工：凱問「現在怎麼辦」並拍板、蘿莎答「怎麼做到」、米拉找「這代表什麼」、索恩施壓「還有多少時間」。
- 台詞中的航程時間（兩 / 三 / 四分鐘）要和 `stages.ts` 的 duration 一起改。

## 試玩支援

- 標題畫面按 2 / 3 / 4 是 STAGE TRIAL 1 / 2 / 3：沒有對話，開場有一條操作提示。
- 每次過關或失敗，`GameApp.finishStage()` 都會產生 `StageReport`，結算畫面會顯示，並可以複製成 JSON。
  - 報告包含 `stillPct`（站著不動的時間比例），用來檢查「站著就能過關」。
- `?time=0.25` 會縮短關卡長度和波次時間，只供開發測試用。

## 驗證遊戲邏輯的方法

headless Chromium 沒有 GPU，FPS 量不準。比較可靠的方法是：

1. 暫時在 `App.tsx` 加上 `window.__game = game`（**不要 commit**）。
2. 停掉 ticker：`__game.app.ticker.stop()`。
3. 用 `__game.tick(1/60)` 逐幀推進，配合 dispatch `KeyboardEvent` 操作，再檢查 `__game.core` / `__game.player` / `__game.waves` 的狀態。
4. 想跑完整關卡時，每幀設定 `__game.player.invincible = 99`。

規則類的改動（吸收、EMP 範圍、計時優先順序等）都應該用這個方法跑過。

## 開發階段（v0.2 第十一節）

- **A**（完成）：第一關的完整循環。
- **B**（完成）：第二關的小行星。
- **C**（完成）：第三關的水雷、新追兵、跳躍和結局。另外加了暫停選單。
- **D**：試玩調整節奏與音畫回饋。

## Known debt

- 數值全部未經試玩：能源供給量、EMP 間隔、飛彈密度、追兵停留時間都需要調整。
- 音效是從現有素材挑的，還沒實際聽過調整：鎖定用 `alarm2`（加速），水雷引信用 `alarm1`（加速），EMP 用 `bigshot3` + `explosion3`，吸收用 `gem-alt`。
- 小行星和水雷會從追兵身上穿過去（追兵不會閃避地形）。
- 跳躍演出只畫了玩家的戰機，畫面上沒有撤離船。
- EMP 演出還沒有通訊雜訊，以及「追擊警報短暫減弱」的效果（v0.2 第四節）。
- `public/assets` 留著舊版的素材，目前沒在用：Boss 圖、pickup 圖。Boss 曲目現在用在第三關最後 30 秒。

## Don't
- 不要在 update loop 裡 `console.log`。
- 不要為了相容舊版本而保留已確定不用的系統。射擊、衝刺、炸彈、Boss 都已經移除，舊版在 tag 裡。
- 不要讓追兵從前方或側面生成。前方只會出現地形或預先布設的水雷。
- 第一版不做這些：開放世界、基地建設、多人、完整裝備樹、每日營運活動。
