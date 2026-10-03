import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export function TitleScreen() {
  const { hiScore, reset } = useGameStore()
  const [blink, setBlink] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 500)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey) }
  }, [reset])

  return (
    <div
      onPointerDown={() => reset()}
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
        RAIDEN
      </div>
      <div style={{ fontSize: 13, color: '#aaaacc', marginTop: 6, letterSpacing: 2 }}>
        PIXEL ASSAULT
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
        FIRE: SPACE &nbsp;&nbsp; BOMB: X / B<br />
        FOCUS (SLOW): HOLD SHIFT<br />
        PAUSE: P / ESC
      </div>
    </div>
  )
}
