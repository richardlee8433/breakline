// Story mode script. Names, places and lines are provisional (game plan §3):
// this is a working draft to be rewritten once the cast is settled.
//
// Format follows Lastlight's dialog data: one [speaker, line] per beat.
// Speakers with a portrait use their id; 'comms' is an unnamed radio voice
// and 'narr' is narration (no name tag, italic).

import type { PortraitId } from '../../art/portraits'

export type Speaker = PortraitId | 'comms' | 'narr'

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
  kai:   { name: '凱',         color: '#f3a24a' },
  rosa:  { name: '蘿莎',       color: '#5ff0d8' },
  nova:  { name: '諾娃博士',   color: '#b9a0ff' },
  halt:  { name: '哈爾特司令', color: '#f2c230' },
  comms: { name: '赫利昂管制', color: '#c8ccd4' },
  narr:  { name: '',           color: '#b8b2c8' },
}

export interface Scene {
  /** Shown above the dialog box: the stage about to start, or the ending.
   *  Empty for in-combat talks. */
  heading: string
  lines: [Speaker, string][]
}

export type SceneId = 'stage1' | 'stage2' | 'stage3' | 'ending' | 'tut-absorb' | 'tut-bomb'

export const SCENES: Record<SceneId, Scene> = {
  // §8 Stage 1 — break the patrol line: meet the evacuation ship and get it
  // through the outer patrols. Teaches shooting, dash, absorb, counter.
  stage1: {
    heading: 'STAGE 1 · 突破巡邏線',
    lines: [
      ['narr', '邊境星系。赫利昂宣布「安全封鎖」的第三天。研究隊的撤離船貼著舊貨運航道，低速前進。'],
      ['comms', '未登記飛行器，這裡是赫利昂封鎖艦隊。你已進入管制空域。'],
      ['halt', '立即關閉引擎、停止飛行，接受登艦審查。'],
      ['halt', '這是唯一一次警告。拒絕配合，本艦隊將視你為威脅，直接開火。'],
      ['kai', '審查？我只是個送貨的。貨單上寫的是「一船科學家」。'],
      ['rosa', '凱，別鬧了。他們要的是撤離船上那枚核心，不是你的貨單。'],
      ['kai', '那妳裝在我飛機上的那顆小的……到底能不能用？'],
      ['rosa', '能用。等一下開打，我在頻道上一步一步教你。'],
      ['kai', '邊飛邊上課。好極了。'],
      ['halt', '倒數三秒。三、二——'],
      ['kai', '撤離船，跟緊我。我們走。'],
    ],
  },
  // §8 Stage 2 — the ruin shortcut: lose the pursuit through an abandoned
  // lane and find the core answering the ruins.
  stage2: {
    heading: 'STAGE 2 · 遺跡捷徑',
    lines: [
      ['narr', '攔截艦拖著黑煙退出戰線。追擊隊正在後方重新集結。'],
      ['nova', '這裡是撤離船。主航道被堵死了，但星圖上還有一條廢棄的舊航道，穿過遺跡帶。'],
      ['rosa', '遺跡帶？那裡連導航信標都沒有。'],
      ['nova', '有，只是不是我們的。凱，你的核心從剛才開始就在回應某種訊號。'],
      ['kai', '回應？它要是開始跟遺跡聊天，記得幫我翻譯。'],
      ['halt', '追擊隊，跟上。他們想走遺跡帶，那就讓遺跡帶替我們收尾。'],
      ['rosa', '側面會有東西衝過來。吸收只顧得到正前方，別貪。'],
    ],
  },
  // §8 Stage 3 — open the blockade: take apart the flagship so the
  // evacuation ship can get through.
  stage3: {
    heading: 'STAGE 3 · 打開封鎖線',
    lines: [
      ['narr', '遺跡守衛停機了。通道重新打開，前方就是封鎖線的最後一道防線。'],
      ['nova', '守衛的結構和你的核心是同一套技術。它們原本可能只是……維修工具。'],
      ['rosa', '維修工具能打穿戰艦護盾的話，我不太想知道它們平常修的是什麼。'],
      ['halt', '全艦隊，旗艦前移。封鎖線不准出現任何缺口。'],
      ['kai', '哈爾特司令，你封住的是一群人回家的路。'],
      ['halt', '我執行的是公司的命令。這件事，不會離開這個星系。'],
      ['kai', '那就讓它離開。撤離船，等我打開缺口，就全速衝過去。'],
    ],
  },
  // ── In-combat talks (story mode): the engineer explains a mechanic the
  // first time it matters. Combat pauses underneath.
  // First energy rounds on screen: how absorbing works and what it buys.
  'tut-absorb': {
    heading: '',
    lines: [
      ['rosa', '凱，看到那些青色的圓環了嗎？那是能源彈，核心吃得下。'],
      ['rosa', '按吸收（鍵盤是 Shift），核心會在機首前方張開扇形的捕捉場，大約半秒。正前方的能源彈會被吸進來。'],
      ['rosa', '吸進來的能量直接灌進主炮。吸得越多，火力越強，最多四級。'],
      ['rosa', '能量夠的時候，核心還會在機身外撐起一層護盾。被打中一次，護盾替你擋下來，代價是掉一級火力。'],
      ['kai', '所以吸得越多，打得越兇，也越耐打。'],
      ['rosa', '對。但側面和後面接不到，橘色的飛彈也接不了。一直吸還會過熱，過熱就只能等它散熱。'],
      ['kai', '了解。張嘴、吃子彈、別吃到飛彈。'],
      ['rosa', '……我不會這樣形容，但大致上沒錯。'],
    ],
  },
  // First bomb picked up: what it is and why to save it.
  'tut-bomb': {
    heading: '',
    lines: [
      ['rosa', '等等，你剛剛撿到的那個……是赫利昂的震波彈匣！'],
      ['rosa', '我把它接上核心了。按炸彈（鍵盤是 E），它會從機身炸開一圈震波：整個畫面的子彈清空、飛彈全部引爆，敵機也會挨一記。'],
      ['kai', '這種好東西，妳怎麼不早點給我？'],
      ['rosa', '因為它不是我的，是從敵機身上掉下來的。最多只能帶三顆，留著救命用。'],
    ],
  },

  // Ending: the flagship loses the ability to hold the line; the evacuation
  // ship gets out. One trait of the core is revealed, nothing more (§2).
  ending: {
    heading: 'MISSION COMPLETE',
    lines: [
      ['narr', '旗艦主炮離線，封鎖網出現缺口。撤離船全速穿了過去。'],
      ['comms', '旗艦失去動力……封鎖網無法維持。'],
      ['halt', '……全艦隊，停止追擊。'],
      ['nova', '我們出來了。所有資料都在，所有人都在。'],
      ['rosa', '凱，你的核心在對另一個方向發訊號。很遠的地方。'],
      ['kai', '又一座遺跡？'],
      ['nova', '也許吧。它從來就不只是一顆電池。'],
      ['kai', '那就下次再說。先送大家回家。'],
    ],
  },
}

/** The intro scene played before each story stage. */
export function introFor(stage: number): SceneId {
  return stage === 2 ? 'stage2' : stage === 3 ? 'stage3' : 'stage1'
}
