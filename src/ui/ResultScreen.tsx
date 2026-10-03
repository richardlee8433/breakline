import { useEffect, useState } from 'react'
import { useGameStore, StageReport } from '../store/gameStore'
import { STORY_STAGES, STORY_LENGTH, stageConfig } from '../game/data/stages'
import { introFor } from '../game/data/story'
import { HULL } from '../game/data/chase'

type Kind = 'stageclear' | 'gameover' | 'complete'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * The screen between attempts: a cleared stage (results, then on to the
 * next briefing), a game over (retry the stage, or rewatch its briefing),
 * or the end of the story. Shows the playtest report so a facilitator can
 * note it after each attempt.
 */
export function ResultScreen({ kind }: { kind: Kind }) {
  const { report, mode, stage, setPhase, retryStage, continueRun, playScene } = useGameStore()
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
  const heading = kind === 'stageclear' ? `STAGE ${stage} CLEAR`
    : kind === 'gameover' ? 'GAME OVER'
    : unfinished ? 'TO BE CONTINUED' : 'ESCAPED'
  const good = kind !== 'gameover'
  const sub = kind === 'stageclear' ? `✓ ${stageConfig(stage).mission}`
    : kind === 'gameover' ? '追兵追上了'
    : unfinished ? `原型目前到第 ${STORY_STAGES.length} 關，第 ${STORY_STAGES.length + 1}–${STORY_LENGTH} 關製作中`
    : '同步跳躍完成，所有人都在。'

  return (
    <div style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,10,0.9)', color: '#fff', fontFamily: 'monospace',
      userSelect: 'none', padding: '30px 18px 26px', boxSizing: 'border-box',
    }}>
      <div style={{
        fontSize: 40, fontWeight: 'bold', letterSpacing: 4, textAlign: 'center',
        color: good ? '#44ffaa' : '#ff2233',
        textShadow: good ? '0 0 16px #00ff88' : '0 0 16px #ff0000',
      }}>
        {heading}
      </div>
      {sub && (
        <div style={{ marginTop: 10, fontSize: 15, color: good ? '#9fe8c8' : '#ff9a8a', fontFamily: '"Noto Sans TC", system-ui, sans-serif', textAlign: 'center' }}>
          {sub}
        </div>
      )}

      {report && <ReportTable r={report} />}

      <div style={{ marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {report && (
          <button onClick={copy} style={buttonStyle('#33aadd')}>{copied ? 'COPIED' : 'COPY RESULT'}</button>
        )}
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
    </div>
  )
}

function buttonStyle(color: string) {
  return {
    background: 'transparent', border: `1px solid ${color}`, color: '#ddeeff',
    padding: '9px 16px', fontFamily: 'monospace', fontSize: 13, letterSpacing: 2, cursor: 'pointer',
  }
}

function ReportTable({ r }: { r: StageReport }) {
  const rows: [string, string | number][] = [
    ['TIME', `${clock(r.seconds)} / ${clock(r.duration)}`],
    ['HULL LEFT', `${r.hullLeft} / ${HULL.max}`],
    ['HITS', `MISSILE ${r.hits.missile} · RAM ${r.hits.ram} · ROCK ${r.hits.rock} · MINE ${r.hits.mine}`],
    ['ROUNDS ABSORBED', r.rounds],
    ['ENERGY BANKED', `${r.banked}  (${r.wasted} OVER LIMIT)`],
    ['EMP PULSES', r.emps],
    ['PURSUERS DISABLED', `${r.disabled}  (${r.shaken} SHAKEN OFF)`],
    ['STANDING STILL', `${r.stillPct}%`],
  ]
  return (
    <div style={{
      marginTop: 20, width: 'min(480px, 94%)', padding: '12px 16px', boxSizing: 'border-box',
      border: '1px solid rgba(100,220,255,0.25)', background: 'rgba(10,25,45,0.5)',
      fontSize: 13, lineHeight: '24px',
    }}>
      <div style={{ color: '#66ddff', letterSpacing: 2, marginBottom: 6, textAlign: 'center' }}>
        STAGE {r.stage} · {r.mode === 'story' ? 'STORY' : 'TRIAL'}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#bbccee' }}>
          <span>{k}</span><span style={{ color: '#fff', textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}
