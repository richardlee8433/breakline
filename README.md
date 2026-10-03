# BREAKLINE

Lastlight 同宇宙的短篇縱向追逐逃生。你駕駛一架裝上古文明核心的拼裝戰機，護送研究隊撤離。追兵從後方咬上來：吸收他們的能源彈充飽 EMP，讓追兵熄火、甩開距離，撐到每一關的終點。

> 不必打贏赫利昂，只要替大家爭取時間。

> **狀態：追逐原型，三關都可以玩。** 第一關是巡邏隊追擊，第二關是小行星捷徑，第三關是水雷封鎖區，最後是同步跳躍和結局。數值都還沒經過試玩調整。
> - 設計文件：[`docs/Breakline_Chase_Prototype_Design_v0.2.txt`](docs/Breakline_Chase_Prototype_Design_v0.2.txt)
> - 改版前的「吸收射擊」原型保留在 tag [`v0.1-absorb-shooter`](https://github.com/richardlee8433/breakline/tree/v0.1-absorb-shooter)

## Run Locally

```bash
npm install
npm run dev
```

開發測試可以加 `?time=0.25`，讓關卡長度和波次時間軸都縮成 1/4。一般玩家不會看到這個選項。

## Controls

| Action | Key | Touch |
|---|---|---|
| Move | Arrow Keys / WASD | 相對拖曳（手指放哪裡都可以） |
| EMP | E / Space | EMP 按鈕 |
| Pause（繼續 / 重來這關 / 音量 / 回標題） | P / Esc，或 HUD 的 ❚❚ 按鈕（切換分頁也會自動暫停） | ❚❚ 按鈕 |
| Mute | M | 🔊 |
| Settings（音樂 / 音效音量） | 首頁按 O | 首頁 SETTINGS 按鈕 |

## 玩法

- **向前飛，撐到時間到**：戰機自動前進，只在畫面中上方移動。生存到關卡時間結束就過關，不需要擊落任何敵機。
- **追兵只從後方來**：進場前，畫面下緣會先亮 0.8 秒的預警標記。追兵會在你後方換位，但不會超到前面。
- **常駐吸收場**：機身周圍的圓形場一直開著，不用按鍵。
  - **青色圓環能源彈完全無害**，碰到吸收場就被吸進來，每顆 +6 能量。
  - 能量每秒最多入帳 18 點。超過的部分照樣吸掉，只是不存。
- **EMP**：能量滿 100 時按 E。
  - 範圍是場地寬度的 0.7 倍，範圍內的追兵熄火 4 秒：不開火、不追、撞到也不扣血，並往後漂。
  - 漂出畫面的追兵算「甩脫」。
  - 範圍內的能源彈和飛彈也會一起清掉。
  - 兩次 EMP 之間至少間隔 8 秒。
- **耐久 3 格**：飛彈、撞上追兵機體、小行星、水雷爆炸，各扣 1 格。受傷後無敵 1.5 秒。每一關都重新給滿。
  - 飛彈發射前會先鎖定：機身上出現鎖定框，並響一聲警示音。
- **小行星**（第二關）：
  - 從前方以列的方式出現，進場前畫面上緣會先亮橘色標記。
  - 每一列都保證留一條通道，而且通道每列只會小幅移動，用飛機的速度一定追得上。
  - EMP 對小行星沒用。
- **水雷**（第三關）：
  - 外圈淡紅色的是感應範圍。一進範圍就開始 1 秒引信，離開也不會取消；撞到本體也是同樣的引信，不會當場爆炸。
  - 爆炸範圍比感應範圍大，傷害只算一次。EMP 對水雷沒用。
- **第三關的新追兵**：
  - 制導飛彈機（藍色機體）：粉紅色飛彈會轉彎，但轉不快，3.4 秒後自行熄火。
  - 抗 EMP 機（紫色引擎）：被 EMP 打中只熄火 1.5 秒。
- **跳躍**：第三關的倒數就是跳躍充能（HUD 顯示 %）。到 100% 時播放同步跳躍演出，接著是結局。最後 30 秒是索恩的最後攔截。

所有數值都在 [`src/game/data/chase.ts`](src/game/data/chase.ts)。

## 模式與關卡

標題畫面：
- **STORY**（按 1 或 Space）：每關開始前有劇情對話。失敗時可以 RETRY（不重播對話），也可以選 BRIEFING 重看開場。
- **STAGE TRIAL 1 / 2 / 3**（按 2 / 3 / 4）：直接開打指定的關卡，沒有對話，給快速試玩用。

| 關卡 | 原型時長（設計） | 內容 | 狀態 |
|---|---|---|---|
| 1 · 巡邏隊追擊 | 2 分（3 分） | 能源無人機、飛彈巡邏機 | ✅ |
| 2 · 小行星捷徑 | 3 分（5 分） | 前方小行星＋後方追兵 | ✅ |
| 3 · 水雷封鎖區 | 4 分（8 分） | 感應水雷、制導飛彈機、抗 EMP 機、同步跳躍 | ✅ |

- 戰鬥中只會有短句通訊，例如蘿莎提醒飛彈鎖定、EMP 充滿，不會打斷遊戲。
- 故事模式中，第三關第一次出現水雷時會暫停一次，由蘿莎說明引信。這是唯一一次戰鬥中斷。

角色（完整設定見 [`docs/characters.md`](docs/characters.md)）：
- **凱・默瑟**：地方貨運飛行員，主角。
- **蘿莎・維加**：工程師。
- **米拉・森博士**：撤離船上的研究員。
- **艾德里安・索恩指揮官**：Helion 封鎖艦隊指揮官。

對話框的手繪胸像是正式立繪（`public/assets/portraits/*.webp`）。台詞在 `src/game/data/story.ts`。

## 試玩報告

每次過關或失敗，結算畫面都會顯示這一關的報告，**COPY RESULT** 可以把報告複製成 JSON。報告包含：

- 存活時間、剩餘耐久、扣血原因（飛彈 / 撞機 / 小行星 / 水雷）
- 吸收的能源彈數，以及存進去 / 超過入帳上限的能量
- EMP 次數、熄火的追兵數、甩脫數
- **站著不動的時間比例**：用來檢查「站著就能過關」的問題

## License

Code: MIT

All assets are CC0 (public domain):

| Asset | Source |
|---|---|
| Tiles & explosion frames | [Kenney Pixel Shmup](https://kenney.nl/assets/pixel-shmup) |
| Asteroid & mine art | Provided by the project owner (`public/assets/hazards`) |
| Ships & enemy art | Custom (`public/assets/ships`, `public/assets/enemies`) — **source/license not yet recorded, confirm before any public release** |
| Backgrounds | `public/assets/bg` carries a Screaming Brain Studios CC0 notice from an earlier version of these files; the current planetary artwork's own source isn't recorded — **confirm before any public release** |
| Music | [SketchyLogic — NES Shooter Music](https://opengameart.org/content/nes-shooter-music-5-tracks-3-jingles) |
| Weapon & explosion SFX | [RUOK — Action Game/SHMUP SFX Pack](https://opengameart.org/content/action-gameshmup-sfx-pack) |
| UI SFX | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) |
