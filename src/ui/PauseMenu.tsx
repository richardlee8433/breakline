import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { stageConfig } from '../game/data/stages'
import { SettingsPanel } from './SettingsPanel'

/** Pause: resume, restart the stage, adjust sound, or leave for the title.
 *  The chase clock is stopped the whole time. */
export function PauseMenu() {
  const { stage, togglePause, retryStage, setPhase } = useGameStore()
  const [settings, setSettings] = useState(false)

  const button = (text: string, onClick: () => void, primary = false) => (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.currentTarget.blur(); onClick() }}
      style={{
        display: 'block', width: 280, padding: '12px 0', fontFamily: 'monospace', fontSize: primary ? 17 : 14,
        letterSpacing: 3, cursor: 'pointer', color: primary ? '#ffffff' : '#aabbcc',
        background: primary ? 'rgba(0,204,255,0.16)' : 'rgba(0,0,0,0.3)',
        border: `1px solid ${primary ? '#33ddff' : '#3a4a5a'}`,
      }}
    >
      {text}
    </button>
  )

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        background: 'rgba(0,0,10,0.78)', color: '#fff', fontFamily: 'monospace', userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 40, letterSpacing: 10, fontWeight: 'bold', textShadow: '0 0 16px #44ddff' }}>PAUSED</div>
      <div style={{ marginBottom: 14, fontSize: 13, color: '#88aacc', letterSpacing: 2, fontFamily: '"Noto Sans TC", system-ui, sans-serif' }}>
        STAGE {stage} · {stageConfig(stage).mission}
      </div>
      {button('RESUME  [P / ESC]', togglePause, true)}
      {button(`RESTART STAGE ${stage}`, retryStage)}
      {button('SETTINGS · SOUND', () => setSettings(true))}
      {button('TITLE', () => setPhase('title'))}

      {settings && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,10,0.7)',
        }}>
          <SettingsPanel onClose={() => setSettings(false)} />
        </div>
      )}
    </div>
  )
}
