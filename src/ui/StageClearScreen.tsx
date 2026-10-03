import { useGameStore } from '../store/gameStore'

/** The beat between a boss kill and the next briefing. GameApp times it on
 *  the ticker and moves on by itself, so there is nothing to press here. */
export function StageClearScreen() {
  const { score, stage } = useGameStore()

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,10,0.7)',
      color: '#fff', fontFamily: 'monospace',
      userSelect: 'none', pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 16, letterSpacing: 8, color: '#88aacc' }}>STAGE {stage}</div>
      <div style={{ marginTop: 8, fontSize: 48, fontWeight: 'bold', color: '#00ffaa',
        textShadow: '0 0 20px #00ffaa', letterSpacing: 6 }}>
        CLEAR
      </div>
      <div style={{ marginTop: 26, fontSize: 30, color: '#ffdd00' }}>
        {String(score).padStart(6, '0')}
      </div>
    </div>
  )
}
