import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export function GameOverScreen() {
  const { score, hiScore, stage, loop, setPhase } = useGameStore()
  const [blink, setBlink] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 550)
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'BUTTON') return
      if (e.code === 'Space' || e.code === 'Enter') setPhase('title')
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey) }
  }, [setPhase])

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
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

      <button
        onClick={() => setPhase('title')}
        style={{
          marginTop: 32, background: 'transparent', border: 0, fontFamily: 'monospace', fontSize: 12,
          letterSpacing: 3, cursor: 'pointer', color: blink ? '#aaaaff' : '#667788',
        }}
      >
        TAP OR PRESS SPACE TO RETRY
      </button>
    </div>
  )
}
