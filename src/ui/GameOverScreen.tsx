import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import {
  fetchGlobalTop10,
  loginToSubmitScore,
  submitViverseScore,
  type ViverseRankingEntry,
} from '../services/viverseLeaderboard'

export function GameOverScreen() {
  const { score, hiScore, stage, loop, setPhase } = useGameStore()
  const [blink, setBlink] = useState(true)
  const [entries, setEntries] = useState<ViverseRankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState('')

  const refreshLeaderboard = async (submitCurrent = false) => {
    setLoading(true)
    try {
      const first = await fetchGlobalTop10()
      setLoggedIn(first.loggedIn)

      if (submitCurrent && first.loggedIn) {
        setSubmitting(true)
        const ok = await submitViverseScore(score)
        setSubmitted(ok)
        if (ok) setStatus('SCORE SYNCED TO VIVERSE')
        const refreshed = await fetchGlobalTop10()
        setEntries(refreshed.entries)
        setLoggedIn(refreshed.loggedIn)
      } else {
        setEntries(first.entries)
      }
    } catch {
      setStatus('VIVERSE RANKING UNAVAILABLE')
    } finally {
      setSubmitting(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshLeaderboard(true)
    const id = setInterval(() => setBlink((b) => !b), 550)
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'BUTTON') return
      if (e.code === 'Space' || e.code === 'Enter') setPhase('title')
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey) }
  }, [setPhase, score])

  const loginAndSubmit = async () => {
    setSubmitting(true)
    setStatus('OPENING VIVERSE LOGIN...')
    try {
      await loginToSubmitScore(score)
    } catch {
      setSubmitting(false)
      setStatus('VIVERSE LOGIN UNAVAILABLE')
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'rgba(0,0,10,0.95)', color: '#fff', fontFamily: 'monospace',
      userSelect: 'none', padding: '30px 18px 26px', boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 36, fontWeight: 'bold', color: '#ff2233', textShadow: '0 0 16px #ff0000', letterSpacing: 4 }}>
        GAME OVER
      </div>

      <div style={{ marginTop: 18, fontSize: 12, color: '#aaa', letterSpacing: 2 }}>SCORE</div>
      <div style={{ fontSize: 27, color: '#ffdd00', marginTop: 4 }}>{String(score).padStart(6, '0')}</div>
      <div style={{ marginTop: 7, fontSize: 10, color: '#666', letterSpacing: 2 }}>
        LOCAL BEST {String(hiScore).padStart(6, '0')} · STAGE {stage} · LOOP {loop}
      </div>

      <div style={{ marginTop: 22, width: 'min(420px, 92vw)' }}>
        <div style={{ fontSize: 12, color: '#66ddff', letterSpacing: 2, textAlign: 'center', marginBottom: 10 }}>
          VIVERSE GLOBAL TOP 10
        </div>
        <div style={{ border: '1px solid rgba(100,220,255,0.25)', background: 'rgba(10,25,45,0.5)', padding: '10px 12px' }}>
          {loading ? (
            <div style={{ color: '#667788', textAlign: 'center', fontSize: 11 }}>LOADING...</div>
          ) : entries.length ? entries.map((entry, i) => (
            <div key={`${entry.uid}-${entry.rank}-${i}`} style={{
              display: 'grid', gridTemplateColumns: '34px 1fr auto', gap: 8,
              fontSize: 11, lineHeight: '21px', color: entry.rank <= 3 ? '#ffee88' : '#bbccee',
            }}>
              <span>#{entry.rank}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name || 'PILOT'}</span>
              <span>{String(Math.round(entry.value)).padStart(7, '0')}</span>
            </div>
          )) : (
            <div style={{ color: '#667788', textAlign: 'center', fontSize: 11 }}>NO SCORES YET</div>
          )}
        </div>
      </div>

      {!loading && !loggedIn && (
        <button
          disabled={submitting}
          onClick={loginAndSubmit}
          style={{
            marginTop: 17, background: submitting ? '#223344' : '#0d4b68', color: '#dff8ff',
            border: '1px solid #33aadd', padding: '10px 15px', fontFamily: 'monospace',
            fontWeight: 'bold', letterSpacing: 1, cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? 'CONNECTING...' : 'LOGIN TO VIVERSE & SUBMIT'}
        </button>
      )}

      {!loading && loggedIn && !submitted && !submitting && (
        <button
          onClick={() => refreshLeaderboard(true)}
          style={{
            marginTop: 17, background: '#0d4b68', color: '#dff8ff', border: '1px solid #33aadd',
            padding: '9px 14px', fontFamily: 'monospace', fontWeight: 'bold', cursor: 'pointer',
          }}
        >
          RETRY SCORE SYNC
        </button>
      )}

      {status && (
        <div style={{
          marginTop: 9, minHeight: 14, fontSize: 10,
          color: status.includes('SYNCED') ? '#77ff99' : status.includes('OPENING') ? '#88ccff' : '#ff8899',
          letterSpacing: 1,
        }}>
          {status}
        </div>
      )}

      <button
        onClick={() => setPhase('title')}
        style={{
          marginTop: 20, background: 'transparent', border: 0, fontFamily: 'monospace', fontSize: 12,
          letterSpacing: 3, cursor: 'pointer', color: blink ? '#aaaaff' : '#667788',
        }}
      >
        TAP OR PRESS SPACE TO RETRY
      </button>
    </div>
  )
}
