import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export function TitleScreen() {
  const { hiScore, startRun } = useGameStore()
  const start = () => startRun(true)
  const [blink, setBlink] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 500)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') start()
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey) }
  }, [startRun])

  return (
    <div
      onPointerDown={start}
      style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,17,0.88)',
      color: '#fff', fontFamily: 'monospace',
      userSelect: 'none', cursor: 'pointer', touchAction: 'none',
    }}>
      <div style={{ fontSize: 11, letterSpacing: 6, color: '#88aaff', marginBottom: 4 }}>
        STAGE 1
      </div>
      <div style={{ fontSize: 42, fontWeight: 'bold', letterSpacing: 4, color: '#00ccff',
        textShadow: '0 0 20px #00ccff, 0 0 40px #0066ff' }}>
        BREAKLINE
      </div>
      <div style={{ fontSize: 13, color: '#aaaacc', marginTop: 6, letterSpacing: 2 }}>
        COMBAT PROTOTYPE
      </div>
      <div style={{ marginTop: 40, fontSize: 11, color: '#888' }}>
        HI-SCORE  {String(hiScore).padStart(6, '0')}
      </div>
      <div style={{
        marginTop: 32, fontSize: 14, letterSpacing: 3,
        color: blink ? '#ffff00' : 'transparent',
        transition: 'color 0.1s',
      }}>
        TAP  OR  PRESS  SPACE  TO  START
      </div>
      <div style={{ marginTop: 48, fontSize: 10, color: '#555', lineHeight: 1.8 }}>
        MOVE: ARROW KEYS / WASD<br />
        FIRE: AUTO<br />
        ABSORB: SHIFT &nbsp;&nbsp; DASH: SPACE &nbsp;&nbsp; COUNTER: E<br />
        PAUSE: P / ESC
      </div>
    </div>
  )
}
