import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'

type LeaderboardEntry = {
  player_name: string
  score: number
  stage: number
  loop: number
  created_at: string
}

const NAME_KEY = 'raiden.playerName'

function loadName() {
  try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' }
}

export function GameOverScreen() {
  const { score, hiScore, stage, loop, setPhase } = useGameStore()
  const [blink, setBlink] = useState(true)
  const [name, setName] = useState(loadName)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState('')

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/leaderboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('offline')
      const data = await res.json()
      setEntries(data.entries ?? [])
      setStatus('')
    } catch {
      setStatus('GLOBAL RANKING UNAVAILABLE')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeaderboard()
    const id = setInterval(() => setBlink((b) => !b), 550)
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'BUTTON') return
      if (e.code === 'Space' || e.code === 'Enter') setPhase('title')
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey) }
  }, [setPhase])

  const submitScore = async () => {
    const playerName = name.trim()
    if (playerName.length < 2) { setStatus('ENTER 2–10 CHARACTERS'); return }
    setSubmitting(true)
    setStatus('')
    try {
      try { localStorage.setItem(NAME_KEY, playerName) } catch { /* ignore */ }
      const res = await fetch('/.netlify/functions/leaderboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          playerName,
          score,
          stage,
          loop,
          gameDuration: 0,
          gameVersion: 'leaderboard-v1',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'submit failed')
      setEntries(data.entries ?? [])
      setSubmitted(true)
      setStatus('SCORE REGISTERED')
    } catch {
      setStatus('COULD NOT SUBMIT SCORE')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'rgba(0,0,10,0.95)', color: '#fff', fontFamily: 'monospace',
      userSelect: 'none', padding: '34px 18px 28px', boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 36, fontWeight: 'bold', color: '#ff2233', textShadow: '0 0 16px #ff0000', letterSpacing: 4 }}>
        GAME OVER
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: '#aaa', letterSpacing: 2 }}>SCORE</div>
      <div style={{ fontSize: 27, color: '#ffdd00', marginTop: 4 }}>{String(score).padStart(6, '0')}</div>
      <div style={{ marginTop: 7, fontSize: 10, color: '#666', letterSpacing: 2 }}>
        LOCAL BEST {String(hiScore).padStart(6, '0')} · STAGE {stage} · LOOP {loop}
      </div>

      <div style={{ marginTop: 24, width: 'min(420px, 92vw)' }}>
        <div style={{ fontSize: 12, color: '#66ddff', letterSpacing: 2, textAlign: 'center', marginBottom: 10 }}>
          GLOBAL TOP 10
        </div>
        <div style={{ border: '1px solid rgba(100,220,255,0.25)', background: 'rgba(10,25,45,0.5)', padding: '10px 12px' }}>
          {loading ? (
            <div style={{ color: '#667788', textAlign: 'center', fontSize: 11 }}>LOADING...</div>
          ) : entries.length ? entries.map((entry, i) => (
            <div key={`${entry.player_name}-${entry.created_at}-${i}`} style={{
              display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 8,
              fontSize: 11, lineHeight: '21px', color: i < 3 ? '#ffee88' : '#bbccee',
            }}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.player_name}</span>
              <span>{String(entry.score).padStart(7, '0')}</span>
            </div>
          )) : (
            <div style={{ color: '#667788', textAlign: 'center', fontSize: 11 }}>NO SCORES YET</div>
          )}
        </div>
      </div>

      {!submitted && (
        <div style={{ marginTop: 18, display: 'flex', gap: 8, width: 'min(420px, 92vw)' }}>
          <input
            value={name}
            maxLength={10}
            placeholder="PILOT NAME"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitScore() } }}
            style={{
              flex: 1, minWidth: 0, boxSizing: 'border-box', background: '#07111f', color: '#fff',
              border: '1px solid #336688', padding: '10px 12px', fontFamily: 'monospace',
              fontSize: 12, letterSpacing: 1, outline: 'none', userSelect: 'text',
            }}
          />
          <button
            disabled={submitting}
            onClick={submitScore}
            style={{
              background: submitting ? '#223344' : '#0d4b68', color: '#dff8ff', border: '1px solid #33aadd',
              padding: '0 14px', fontFamily: 'monospace', fontWeight: 'bold', cursor: submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? '...' : 'SUBMIT'}
          </button>
        </div>
      )}

      {status && <div style={{ marginTop: 9, minHeight: 14, fontSize: 10, color: status.includes('REGISTERED') ? '#77ff99' : '#ff8899', letterSpacing: 1 }}>{status}</div>}

      <button
        onClick={() => setPhase('title')}
        style={{
          marginTop: 22, background: 'transparent', border: 0, fontFamily: 'monospace', fontSize: 12,
          letterSpacing: 3, cursor: 'pointer', color: blink ? '#aaaaff' : '#667788',
        }}
      >
        TAP OR PRESS SPACE TO RETRY
      </button>
    </div>
  )
}
