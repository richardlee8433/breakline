// Story mode script. Cast and voices follow docs/characters.md:
// Kai asks "what now" and makes the call; Rosa answers "how", with the
// machine's limits; Mira works out "what it means"; Thorne presses "how much
// time you have". Places and plot details are still provisional (plan §3).
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

export type SceneId = 'stage1' | 'stage2' | 'stage3' | 'ending' | 'tut-absorb' | 'tut-bomb'

export const SCENES: Record<SceneId, Scene> = {
  // §8 Stage 1 — break the patrol line: meet the evacuation ship and get it
  // through the outer patrols.
  stage1: {
    heading: 'STAGE 1 · 突破巡邏線',
    lines: [
      ['narr', '邊境星系。赫利昂宣布「安全封鎖」的第三天。研究隊的撤離船貼著舊貨運航道，低速前進。'],
      ['comms', '未登記飛行器，這裡是赫利昂封鎖艦隊。你已進入管制空域，請報上識別碼。'],
      ['kai', '識別碼……貨運執照算嗎？過期兩天那張。'],
      ['thorne', '我是封鎖艦隊指揮官索恩。關閉引擎，停止飛行，接受登艦審查。'],
      ['thorne', '你們帶走的裝置還沒有完成安全評估。這不是針對你個人。'],
      ['kai', '審查要多久？我的貨不太喜歡等。'],
      ['thorne', '你有六十秒。之後，本艦隊會把你視為威脅處理。'],
      ['rosa', '他是認真的。巡邏線上至少十二架無人機。'],
      ['kai', '撤離船，聽到了嗎？我們不等審查了。'],
      ['mira', '聽到了。我們跟在你後面。……拜託走直線。'],
      ['kai', '我的工作是把貨送到。今天的貨比較會尖叫。'],
      ['rosa', '那就別讓它尖叫。開火以後，我在頻道上教你用核心。'],
      ['thorne', '時間到。'],
    ],
  },
  // §8 Stage 2 — the ruin shortcut: lose the pursuit through an abandoned
  // lane, and find the core answering the ruins.
  stage2: {
    heading: 'STAGE 2 · 遺跡捷徑',
    lines: [
      ['narr', '攔截艦拖著黑煙退出戰線。追擊隊在後方重新集結。'],
      ['thorne', '追擊隊，全速跟上。他們的燃料撐不到下一個補給點。'],
      ['rosa', '他沒算錯。照這個速度，我們剩二十分鐘的燃料。'],
      ['kai', '那就不走大路。博士，有捷徑嗎？'],
      ['mira', '有一條廢棄的舊航道，穿過遺跡帶。星圖上標著「禁止通行」。'],
      ['mira', '另外，你的核心從剛才開始就在回應那裡的訊號。可能是巧合。我不這麼認為。'],
      ['kai', '我的貨開始跟遺跡聊天了。好，走遺跡帶。'],
      ['rosa', '航道窄，追擊隊會從側面切進來。吸收只顧得到正前方，別貪。'],
      ['thorne', '你們正把一枚未評估的裝置，帶進一片未評估的遺跡。我會在出口等你們。'],
    ],
  },
  // §8 Stage 3 — open the blockade. Mira reads the guardian as a repair
  // routine, and gets her moment to choose the people over the research.
  stage3: {
    heading: 'STAGE 3 · 打開封鎖線',
    lines: [
      ['narr', '遺跡守衛停機了。通道重新打開，前方是封鎖線的最後一道防線：索恩的旗艦。'],
      ['mira', '我想通了。守衛剛才那套動作不是攻擊，是維修程序。它在檢查我們。'],
      ['mira', '好消息，它認得我們的核心。壞消息，它似乎認為我們需要維修。'],
      ['rosa', '那我們裝的這顆，本來是什麼？'],
      ['mira', '可能是維修工具。還不能確定。'],
      ['thorne', '旗艦前移。封鎖網收緊，三分鐘內完成合圍。'],
      ['kai', '三分鐘。博士，撤離船撐得住嗎？'],
      ['mira', '撐得住。……如果我把掃描陣列關掉，電力全部轉給護盾。'],
      ['rosa', '那是妳記錄遺跡的唯一設備。'],
      ['mira', '資料可以再找，人沒辦法。已經轉了。'],
      ['thorne', '默瑟先生，你可以不相信公司。但你正在運送的東西，也不會因此變得安全。'],
      ['kai', '也許吧。但把人關在這裡，也不會比較安全。'],
      ['kai', '蘿莎，旗艦怎麼打？'],
      ['rosa', '火力集中在正面。能源彈就接，飛彈就閃。打到它失去動力，它就封不住航道。'],
      ['kai', '好。撤離船，等我打開缺口，全速衝。'],
    ],
  },

  // ── In-combat talks (story mode): the engineer explains a mechanic the
  // first time it matters, saying only what to do right now. Combat pauses
  // underneath.
  // First energy rounds on screen: how absorbing works and what it buys.
  'tut-absorb': {
    heading: '',
    lines: [
      ['rosa', '凱，前面那些青色圓環是能源彈。別躲，接住它。'],
      ['rosa', '按吸收（鍵盤是 Shift），核心會在機頭前張開半秒的捕捉場。正前方的能源彈會被吸進來。'],
      ['rosa', '吸進來的能量直接進主炮。吸越多，火力越強。'],
      ['rosa', '能量夠的話，機身外會撐起護盾。被打中一次，護盾替你擋，代價是掉一級火力。'],
      ['kai', '所以吃得越多，越耐打。'],
      ['rosa', '只吃正前方。側面和後面接不到。橘色飛彈是實心的，也接不到。'],
      ['rosa', '一直吸會過熱。過熱就先閃，等它散熱。射擊跟衝刺照常能用。'],
      ['mira', '有意思。它不像在充電，比較像在回收能源。……這代表什麼，我還不能確定。'],
      ['kai', '博士，等我們活下來再研究。'],
    ],
  },
  // First bomb picked up: what it is and why to save it.
  'tut-bomb': {
    heading: '',
    lines: [
      ['rosa', '等等，你剛撿到的是赫利昂的震波彈匣。'],
      ['kai', '妳認得？'],
      ['rosa', '以前替他們做外包維修，這型號我拆過不只一次。已經接上核心了。'],
      ['rosa', '按炸彈（鍵盤是 E），整個畫面的子彈清掉、飛彈全部引爆，畫面上的敵機都會挨一記。'],
      ['rosa', '最多帶三顆，只能從敵機身上撿。留著救命用。'],
      ['kai', '收到。救我的命，或救撤離船的命。'],
    ],
  },

  // Ending: the flagship loses the power to hold the line and the evacuation
  // ship gets out. Thorne calls off the pursuit for his own crew's sake, and
  // the core reveals one more thing, nothing more (§2).
  ending: {
    heading: 'MISSION COMPLETE',
    lines: [
      ['narr', '旗艦主炮離線，封鎖網出現缺口。撤離船全速穿了過去。'],
      ['comms', '指揮官，旗艦動力剩四成。追擊隊請求繼續攔截。'],
      ['thorne', '……駁回。再追下去，會先賠上我們自己的船員。'],
      ['thorne', '全艦隊，停止追擊。默瑟先生，這件事還沒有結束。'],
      ['kai', '我知道。下次記得先問貨主。'],
      ['mira', '我們出來了。所有人都在。'],
      ['rosa', '凱，核心在對另一個方向發訊號。很遠的地方。'],
      ['mira', '另一座遺跡。可能。……這次我會先確定再說。'],
      ['kai', '下次再說。先送大家回家。'],
    ],
  },
}

/** The intro scene played before each story stage. */
export function introFor(stage: number): SceneId {
  return stage === 2 ? 'stage2' : stage === 3 ? 'stage3' : 'stage1'
}
