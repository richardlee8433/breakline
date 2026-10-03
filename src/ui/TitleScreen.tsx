import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { GameMode } from '../game/data/stages'
import { SettingsPanel } from './SettingsPanel'

export function TitleScreen() {
  const startRun = useGameStore((s) => s.startRun)
  const [blink, setBlink] = useState(true)
  const [settings, setSettings] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 500)
    const onKey = (e: KeyboardEvent) => {
      // While settings are open, keys belong to the panel (sliders use the
      // arrows, buttons use Space/Enter); only Esc is ours, to close it.
      if (settings) {
        if (e.code === 'Escape') setSettings(false)
        return
      }
      if (e.code === 'KeyO') { setSettings(true); return }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Digit1') startRun('story')
      // Stage 1 straight away, no dialog: quick playtests.
      if (e.code === 'Digit2') startRun('trial')
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(id); window.removeEventListener('keydown', onKey) }
  }, [startRun, settings])

  const option = (mode: GameMode, text: string, hint: string, primary: boolean) => (
    <button
      onPointerDown={(e) => { e.stopPropagation(); startRun(mode) }}
      style={{
        display: 'block', width: 360, margin: '0 auto', padding: '12px 0',
        fontFamily: 'monospace', letterSpacing: 3, cursor: 'pointer',
        background: primary ? 'rgba(0,204,255,0.14)' : 'transparent',
        border: `1px solid ${primary ? '#33ddff' : '#334455'}`,
        color: primary ? (blink ? '#ffff66' : '#ffffff') : '#8899aa',
        fontSize: primary ? 18 : 14,
      }}
    >
      {text}
      <div style={{ fontSize: 11, letterSpacing: 2, marginTop: 4, color: primary ? '#88ccdd' : '#556677' }}>
        {hint}
      </div>
    </button>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,17,0.88)',
      color: '#fff', fontFamily: 'monospace',
      userSelect: 'none', touchAction: 'none',
    }}>
      <div style={{ fontSize: 56, fontWeight: 'bold', letterSpacing: 6, color: '#00ccff',
        textShadow: '0 0 20px #00ccff, 0 0 40px #0066ff' }}>
        BREAKLINE
      </div>
      <div style={{ fontSize: 15, color: '#aaaacc', marginTop: 8, letterSpacing: 3 }}>
        CHASE PROTOTYPE
      </div>
      <div style={{ marginTop: 12, fontSize: 14, color: '#8fa4b8', fontFamily: '"Noto Sans TC", system-ui, sans-serif', letterSpacing: 2 }}>
        不必打贏赫利昂，只要替大家爭取時間。
      </div>

      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {option('story', 'STORY', 'WITH BRIEFINGS · TAP · SPACE · 1', true)}
        {option('trial', 'STAGE 1 TRIAL', 'NO DIALOG · PLAYTEST · PRESS 2', false)}
        <button
          // Open on click (after release), not pointerdown: on touch, the click
          // that follows the tap would otherwise land on the panel's DONE
          // button, which sits under the finger, and close it at once.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setSettings(true)}
          style={{
            display: 'block', width: 360, margin: '0 auto', padding: '9px 0',
            fontFamily: 'monospace', letterSpacing: 3, cursor: 'pointer', fontSize: 14,
            background: 'transparent', border: '1px solid #334455', color: '#8899aa',
          }}
        >
          SETTINGS · SOUND [O]
        </button>
      </div>

      <div style={{ marginTop: 24, fontSize: 13, color: '#778', lineHeight: 1.9, textAlign: 'center' }}>
        MOVE: ARROW KEYS / WASD / DRAG &nbsp;·&nbsp; <span style={{ color: '#33eeff' }}>EMP: E / SPACE</span><br />
        <span style={{ color: '#33eeff' }}>◯ CYAN RINGS: AUTO-ABSORBED → EMP</span> &nbsp;·&nbsp;
        <span style={{ color: '#ff6a33' }}>▲ MISSILES &amp; SHIPS: DODGE</span><br />
        SURVIVE THE CLOCK &nbsp;·&nbsp; PAUSE: P / ESC
      </div>

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
