// Story mode script. Cast and voices follow docs/characters.md:
// Kai asks "what now" and makes the call; Rosa answers "how", with the
// machine's limits; Mira works out "what it means"; Thorne presses "how much
// time you have".
//
// Format follows Lastlight's dialog data: one [speaker, line] per beat.
// Speakers with a portrait use their id; 'comms' is an unnamed radio voice
// and 'narr' is narration (no name tag, italic).

import type { PortraitId } from '../../art/portraits'

export type Speaker = PortraitId | 'comms' | 'narr'

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
  kai:   { name: '凱・默瑟',     color: '#f3a24a' },
  rosa:  { name: '蘿莎・維加',   color: '#5ff0d8' },
  mira:  { name: '米拉・森博士', color: '#b9a0ff' },
  thorne: { name: '索恩指揮官', color: '#f2c230' },
  comms: { name: '赫利昂管制', color: '#c8ccd4' },
  narr:  { name: '',           color: '#b8b2c8' },
}

export interface Scene {
  /** Shown above the dialog box: the stage about to start, or the ending.
   *  Empty for in-combat talks. */
  heading: string
  lines: [Speaker, string][]
}

export type SceneId = 'stage1' | 'stage2' | 'stage3' | 'ending' | 'tut-mine'

// Scripts from docs/Breakline_Chase_Prototype_Design_v0.2.txt (§6–9): three
// stages of escape with an end point, no boss to destroy. The rules of the
// chase (the always-on field, the EMP, what can't be absorbed) are taught
// here, in the briefing, so combat itself only carries short radio lines.
// Durations in the lines match the prototype's 2 / 3 / 4 minute stages
// (the design document's 3 / 5 / 8); change both together.
export const SCENES: Record<SceneId, Scene> = {
  // §6 Stage 1 — patrol pursuit: reach the asteroid belt entrance.
  stage1: {
    heading: 'STAGE 1 · 巡邏隊追擊',
    lines: [
      ['narr', '赫利昂宣布「安全封鎖」的第三天。凱的舊戰機與研究隊撤離船離開貨運航道，後方的巡邏燈一盞接一盞亮起。'],
      ['comms', '未登記飛行器，立即減速。封鎖艦隊正在接近。'],
      ['thorne', '默瑟先生，關閉引擎，交出裝置。我們可以避免不必要的損失。'],
      ['kai', '我今天的貨不接受退貨。博士，你們跟得上嗎？'],
      ['mira', '跟得上。我們會同步你的航向。'],
      ['rosa', '前面兩分鐘航程就是小行星帶。先別想打贏他們，飛到入口就好。'],
      ['kai', '那顆核心呢？總不能只拿來照亮駕駛艙。'],
      ['rosa', '回收場已經常駐了。飛機周圍的青色能源彈會自動吸進來，存滿就能放 EMP。'],
      ['rosa', 'EMP 能讓追兵暫時熄火。橘色飛彈跟敵機本體吸不掉，看到就閃。'],
      ['kai', '收到。借他們的電，關他們的引擎。'],
      ['thorne', '巡邏隊，追上去。保持鎖定。'],
      ['kai', '撤離船，跟緊我。我們只需要兩分鐘。'],
    ],
  },
  // §7 Stage 2 — the asteroid shortcut: rocks ahead, pursuers behind.
  stage2: {
    heading: 'STAGE 2 · 小行星捷徑',
    lines: [
      ['narr', '小行星帶就在眼前。密集岩塊遮住遠方的星光，赫利昂追兵仍緊咬在後。'],
      ['kai', '博士，這條捷徑看起來少了一條路。'],
      ['mira', '舊測繪資料有通道。依目前航速，穿過去要三分鐘。'],
      ['rosa', '我會標出前面的岩塊。EMP 只能處理後面的追兵，石頭不吃這套。'],
      ['kai', '所以前面看路，後面借電。明白。'],
      ['thorne', '追擊隊，保持間距，跟隨他們的航跡。不要盲目切入岩群。'],
      ['mira', '凱，核心在回應岩帶深處的訊號。那裡可能有古文明設施。'],
      ['kai', '能幫我們開路嗎？'],
      ['mira', '還不能確定。我先標出安全通道，研究可以等。'],
      ['rosa', '那就跟著標記走。追兵逼近時再放 EMP，別指望它替你搬石頭。'],
      ['kai', '好。三分鐘後，我們到另一邊。'],
    ],
  },
  // §8 Stage 3 — the mine blockade: hold out while the jump drive charges.
  stage3: {
    heading: 'STAGE 3 · 水雷封鎖區',
    lines: [
      ['narr', '兩艘船衝出小行星帶。前方航道漂浮著赫利昂預先布下的太空水雷，後方亮起一批新的引擎。'],
      ['thorne', '默瑟先生，你們已進入水雷封鎖區。現在停船，還有選擇。'],
      ['kai', '蘿莎，告訴我我們也有別的選擇。'],
      ['rosa', '有。撤離船的跳躍裝置已經啟動，但要四分鐘才能充滿。'],
      ['mira', '同步連線正常。充能完成後，我們可以把你的戰機一起帶走。'],
      ['kai', '四分鐘。那些漂著的東西呢？'],
      ['rosa', '感應水雷。靠近就啟動，一秒後爆炸。看見警示圈就立刻離開，EMP 關不掉它。'],
      ['comms', '新型追擊隊已抵達。請求攔截授權。'],
      ['thorne', '授權。優先阻止跳躍，保持隊形。'],
      ['rosa', '新型機抗干擾，EMP 只能讓它們停一下。抓準時機，別以為放完就安全了。'],
      ['mira', '我把非必要掃描關掉，電力轉給跳躍與護盾。資料可以再找，人沒辦法。'],
      ['kai', '好。博士負責倒數，蘿莎看著核心。我負責別撞上去。'],
    ],
  },
  // In-combat talk (combat pauses under it): the first mine on screen.
  // The one rule worth stopping the chase for — the fuse can't be undone.
  'tut-mine': {
    heading: '',
    lines: [
      ['rosa', '凱，前面那顆就是感應水雷。看到它外面那圈淡紅色了嗎？那是感應範圍。'],
      ['rosa', '一進圈就開始倒數，一秒後爆炸。就算你馬上出去，倒數也不會停。'],
      ['kai', '撞到本體呢？'],
      ['rosa', '一樣是一秒引信，不會當場炸。但爆炸範圍比感應圈大，看到紅圈閃就往外飛，別回頭。'],
      ['rosa', 'EMP 對它沒用。只能閃。'],
      ['kai', '收到。看到紅圈就跑。'],
    ],
  },
  // §9 Ending — the synchronized jump, and what the core points at next.
  ending: {
    heading: 'MISSION COMPLETE',
    lines: [
      ['narr', '跳躍充能到達百分之百。撤離船展開一道光環，凱的戰機被同步場包住，兩艘船在水雷引爆前消失。'],
      ['comms', '目標已跳躍。攔截失敗。是否沿殘留航跡追擊？'],
      ['thorne', '駁回。前方還有我們自己的水雷。先收回追擊隊。'],
      ['thorne', '默瑟先生……希望你知道自己帶走的是什麼。'],
      ['narr', '遠離封鎖區的一片安靜星空。兩艘船重新出現在同一條航線上。'],
      ['mira', '同步跳躍完成。所有人都在，護航戰機也在。'],
      ['rosa', '凱，報一下狀況。'],
      ['kai', '船還在。我也在。貨應該可以給五星了。'],
      ['rosa', '先別評價。你的核心又在對遠方發訊號。'],
      ['mira', '不是赫利昂的頻率。可能是另一座古文明設施。'],
      ['kai', '把位置記下來。這次先不接新訂單。'],
      ['rosa', '難得你說了句我同意的話。'],
      ['kai', '先送大家回家。'],
    ],
  },
}

/** The intro scene played before each story stage. */
export function introFor(stage: number): SceneId {
  return stage === 2 ? 'stage2' : stage === 3 ? 'stage3' : 'stage1'
}
