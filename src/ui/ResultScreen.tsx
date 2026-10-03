import { useEffect, useState } from 'react'
import { useGameStore, HitCause } from '../store/gameStore'
import { STORY_STAGES, STORY_LENGTH, stageConfig } from '../game/data/stages'
import { introFor } from '../game/data/story'
import { LIVES, SCORE } from '../game/data/chase'

type Kind = 'stageclear' | 'gameover' | 'complete'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const num = (n: number) => n.toLocaleString('en-US')
const cjk = '"Noto Sans TC", system-ui, sans-serif'

/** How the last life was lost, in words. */
const FATAL: Record<HitCause, string> = {
  missile: '被飛彈擊落',
  ram: '和追兵相撞，機體損毀',
  rock: '撞上小行星，機體損毀',
  mine: '被水雷炸毀',
}

/**
 * Between attempts, kept short: a cleared stage shows its score (hull
 * integrity + lives left), a game over says what brought the ship down,
 * the end of the story totals the run. The full playtest numbers are one
 * small link away, for whoever is collecting them.
 */
export function ResultScreen({ kind }: { kind: Kind }) {
  const { report, mode, stage, stageScores, setPhase, retryStage, continueRun, playScene } = useGameStore()
  const [blink, setBlink] = useState(true)
  const [copied, setCopied] = useState(false)
  const story = mode === 'story'

  // The primary action, also on Enter.
  const primary = kind === 'complete' ? () => setPhase('title')
    : kind === 'stageclear' ? (story ? continueRun : retryStage)
    : retryStage
  const primaryText = kind === 'complete' ? 'TITLE'
    : kind === 'stageclear' ? (story ? 'CONTINUE' : 'RETRY')
    : `RETRY STAGE ${stage}`

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 550)
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'BUTTON') return
      if (e.code === 'Enter') primary()
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey) }
  })

  const copy = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(JSON.stringify({ ...report, at: new Date().toISOString() }))
      setCopied(true)
    } catch { /* clipboard blocked (insecure origin / permissions) */ }
  }

  const unfinished = STORY_STAGES.length < STORY_LENGTH
  const total = Object.values(stageScores).reduce((a, b) => a + b, 0)
  const good = kind !== 'gameover'
  const heading = kind === 'stageclear' ? `STAGE ${stage} CLEAR`
    : kind === 'gameover' ? 'GAME OVER'
    : unfinished ? 'TO BE CONTINUED' : 'ESCAPED'

  return (
    <div style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,10,0.9)', color: '#fff', fontFamily: 'monospace',
      userSelect: 'none', padding: '30px 18px 26px', boxSizing: 'border-box', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 40, fontWeight: 'bold', letterSpacing: 4,
        color: good ? '#44ffaa' : '#ff2233',
        textShadow: good ? '0 0 16px #00ff88' : '0 0 16px #ff0000',
      }}>
        {heading}
      </div>

      {kind === 'stageclear' && report && (
        <>
          <div style={{ marginTop: 10, fontSize: 15, color: '#9fe8c8', fontFamily: cjk }}>✓ {stageConfig(stage).mission}</div>
          <Score value={report.score} />
          <Breakdown integrity={report.integrity} lives={report.livesLeft} />
          {story && Object.keys(stageScores).length > 1 && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#8899aa', letterSpacing: 2 }}>RUN TOTAL {num(total)}</div>
          )}
        </>
      )}

      {kind === 'gameover' && report && (
        <>
          <div style={{ marginTop: 12, fontSize: 18, color: '#ff9a8a', fontFamily: cjk }}>
            {report.fatal ? FATAL[report.fatal] : '機體損毀'}
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: '#8899aa', letterSpacing: 2 }}>
            STAGE {stage} · {clock(report.seconds)} / {clock(report.duration)}
          </div>
        </>
      )}

      {kind === 'complete' && (
        unfinished ? (
          <div style={{ marginTop: 10, fontSize: 15, color: '#9fe8c8', fontFamily: cjk }}>
            原型目前到第 {STORY_STAGES.length} 關，第 {STORY_STAGES.length + 1}–{STORY_LENGTH} 關製作中
          </div>
        ) : (
          <>
            <div style={{ marginTop: 10, fontSize: 15, color: '#9fe8c8', fontFamily: cjk }}>同步跳躍完成，所有人都在。</div>
            {story ? (
              <>
                <Score value={total} label="TOTAL SCORE" />
                <div style={{ marginTop: 10, fontSize: 13, color: '#8899aa', letterSpacing: 2, lineHeight: '22px' }}>
                  {STORY_STAGES.map((st) => (
                    <div key={st.id}>STAGE {st.id} · {num(stageScores[st.id] ?? 0)}</div>
                  ))}
                </div>
              </>
            ) : report && (
              <>
                <Score value={report.score} />
                <Breakdown integrity={report.integrity} lives={report.livesLeft} />
              </>
            )}
          </>
        )
      )}

      <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={primary} style={{ ...buttonStyle('#8888ff'), color: blink ? '#ccccff' : '#8899aa' }}>
          {primaryText} [ENTER]
        </button>
        {kind === 'gameover' && story && (
          // Design v0.2 §10: a retry skips the briefing; this replays it.
          <button onClick={() => playScene(introFor(stage))} style={buttonStyle('#556677')}>BRIEFING</button>
        )}
        {kind !== 'complete' && (
          <button onClick={() => setPhase('title')} style={buttonStyle('#556677')}>TITLE</button>
        )}
      </div>

      {/* Playtest numbers stay available, just out of the way. */}
      {report && (
        <button onClick={copy} style={{
          marginTop: 18, background: 'none', border: 'none', color: '#556677', cursor: 'pointer',
          fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, textDecoration: 'underline',
        }}>
          {copied ? 'COPIED' : 'COPY PLAYTEST DATA'}
        </button>
      )}
    </div>
  )
}

function Score({ value, label = 'SCORE' }: { value: number; label?: string }) {
  return (
    <>
      <div style={{ marginTop: 22, fontSize: 13, color: '#88aacc', letterSpacing: 4 }}>{label}</div>
      <div style={{ fontSize: 46, fontWeight: 'bold', color: '#ffdd44', textShadow: '0 0 14px #ffaa00', letterSpacing: 2 }}>
        {num(value)}
      </div>
    </>
  )
}

/** Where the score came from: hull integrity and lives left. */
function Breakdown({ integrity, lives }: { integrity: number; lives: number }) {
  return (
    <div style={{ marginTop: 10, fontSize: 14, color: '#bbccee', fontFamily: cjk, lineHeight: '24px' }}>
      機體完整度 {integrity}%　<span style={{ color: '#ffdd44' }}>+{num(integrity * SCORE.perIntegrityPct)}</span>
      <br />
      剩餘生命 <span style={{ color: '#ff6a7a' }}>{'♥'.repeat(lives)}</span>
      <span style={{ color: '#4a4f5c' }}>{'♡'.repeat(Math.max(0, LIVES.start - lives))}</span>　
      <span style={{ color: '#ffdd44' }}>+{num(lives * SCORE.perLife)}</span>
    </div>
  )
}

function buttonStyle(color: string) {
  return {
    background: 'transparent', border: `1px solid ${color}`, color: '#ddeeff',
    padding: '9px 16px', fontFamily: 'monospace', fontSize: 13, letterSpacing: 2, cursor: 'pointer',
  }
}
