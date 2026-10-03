import { useEffect, useState } from 'react'
import { useGameStore, RunReport } from '../store/gameStore'

/** End-of-run screen: a game over, or `cleared` when the arena was survived.
 *  Shows the playtest report so a facilitator can note it after each run. */
export function GameOverScreen({ cleared = false }: { cleared?: boolean }) {
  const { score, hiScore, setPhase, report } = useGameStore()
  const [blink, setBlink] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 550)
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'BUTTON') return
      if (e.code === 'Enter') setPhase('title')
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey) }
  }, [setPhase])

  const copy = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(JSON.stringify({ ...report, at: new Date().toISOString() }))
      setCopied(true)
    } catch { /* clipboard blocked (insecure origin / permissions) */ }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,10,0.95)', color: '#fff', fontFamily: 'monospace',
      userSelect: 'none', padding: '30px 18px 26px', boxSizing: 'border-box',
    }}>
      <div style={{
        fontSize: 40, fontWeight: 'bold', letterSpacing: 4,
        color: cleared ? '#44ffaa' : '#ff2233',
        textShadow: cleared ? '0 0 16px #00ff88' : '0 0 16px #ff0000',
      }}>
        {cleared ? 'ARENA CLEAR' : 'GAME OVER'}
      </div>

      <div style={{ marginTop: 16, fontSize: 30, color: '#ffdd00' }}>{String(score).padStart(6, '0')}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#777', letterSpacing: 2 }}>
        LOCAL BEST {String(hiScore).padStart(6, '0')}
      </div>

      {report && <ReportTable r={report} />}

      <div style={{ marginTop: 22, display: 'flex', gap: 16 }}>
        {report && (
          <button onClick={copy} style={buttonStyle('#33aadd')}>
            {copied ? 'COPIED' : 'COPY RESULT'}
          </button>
        )}
        <button onClick={() => setPhase('title')} style={{ ...buttonStyle('#8888ff'), color: blink ? '#ccccff' : '#8899aa' }}>
          RETRY [ENTER]
        </button>
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

function ReportTable({ r }: { r: RunReport }) {
  const deaths = r.deaths.energy + r.deaths.missile + r.deaths.hull + r.deaths.beam
  const rows: [string, string | number][] = r.mode === 'core' ? [
    ['ABSORB WINDOWS', `${r.windows}  (${r.whiffs} EMPTY)`],
    ['ROUNDS CAUGHT', r.catches],
    ['COUNTERS FIRED', `${r.counters}  (${r.counterKills} KILLS)`],
    ['OVERHEATS', `${r.overheats}  (${r.overheatSeconds}s LOCKED)`],
    ['COUNTER READY, UNUSED', `${r.readyIdleSeconds}s`],
    ['DASHES', r.dashes],
    ['DEATHS', `${deaths}  (${r.deathsWhileAbsorbing} WHILE ABSORBING)`],
  ] : [
    ['DASHES', r.dashes],
    ['DEATHS', deaths],
  ]
  return (
    <div style={{
      marginTop: 20, width: 'min(460px, 92%)', padding: '12px 16px',
      border: '1px solid rgba(100,220,255,0.25)', background: 'rgba(10,25,45,0.5)',
      fontSize: 13, lineHeight: '24px',
    }}>
      <div style={{ color: '#66ddff', letterSpacing: 2, marginBottom: 6, textAlign: 'center' }}>
        {r.mode === 'core' ? 'CORE RUN' : 'CONTROL RUN (NO CORE)'} · {r.seconds}s
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: '#bbccee' }}>
          <span>{k}</span><span style={{ color: '#fff' }}>{v}</span>
        </div>
      ))}
      {deaths > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#778899', textAlign: 'center' }}>
          KILLED BY · ENERGY {r.deaths.energy} · MISSILE {r.deaths.missile} · HULL {r.deaths.hull} · BEAM {r.deaths.beam}
        </div>
      )}
    </div>
  )
}
