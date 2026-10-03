import { useGameStore } from '../store/gameStore'
import { musicSystem } from '../game/systems/MusicSystem'
import { audioSystem } from '../game/systems/AudioSystem'

const CYAN = '#33ddff'

/** Title-screen settings: separate music / sound-effect levels plus the
 *  master mute. Values persist in this browser (see gameStore). */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { musicVolume, sfxVolume, soundEnabled, setMusicVolume, setSfxVolume, toggleSound } = useGameStore()

  // Moving the music slider starts the title theme if nothing is playing yet
  // (browsers only allow audio after a gesture, and this is one), so the
  // level can be judged by ear.
  const onMusic = (v: number) => {
    setMusicVolume(v)
    if (soundEnabled && !musicSystem.playing) musicSystem.playTitle()
  }
  const onSfx = (v: number) => {
    setSfxVolume(v)
    if (soundEnabled) audioSystem.playPreview()
  }

  return (
    <div
      role="dialog"
      aria-labelledby="settings-title"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: 380, maxWidth: '92%', padding: '22px 26px',
        background: 'rgba(4,14,30,0.96)', border: `1px solid ${CYAN}`,
        boxShadow: `0 0 24px rgba(51,221,255,0.25)`,
        fontFamily: 'monospace', color: '#dfefff',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}
    >
      <style>{`
        .bl-range { width: 100%; accent-color: ${CYAN}; height: 22px; cursor: pointer; }
        .bl-range:focus-visible, .bl-btn:focus-visible { outline: 2px solid #ffffff; outline-offset: 3px; }
      `}</style>
      <div id="settings-title" style={{ fontSize: 20, letterSpacing: 6, color: CYAN, textAlign: 'center' }}>
        SETTINGS
      </div>

      <Slider id="music-volume" label="MUSIC" value={musicVolume} onChange={onMusic} disabled={!soundEnabled} />
      <Slider id="sfx-volume" label="SOUND EFFECTS" value={sfxVolume} onChange={onSfx} disabled={!soundEnabled} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, letterSpacing: 2 }}>
        <span>ALL SOUND</span>
        <button
          className="bl-btn"
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          style={{
            minWidth: 88, padding: '6px 12px', fontFamily: 'monospace', fontSize: 13, letterSpacing: 2,
            cursor: 'pointer', color: soundEnabled ? '#001018' : '#ff8a80',
            background: soundEnabled ? CYAN : 'transparent',
            border: `1px solid ${soundEnabled ? CYAN : '#ff8a80'}`,
          }}
        >
          {soundEnabled ? 'ON' : 'MUTED'}
        </button>
      </div>

      <button
        className="bl-btn"
        onClick={onClose}
        style={{
          marginTop: 4, padding: '10px 0', fontFamily: 'monospace', fontSize: 15, letterSpacing: 4,
          cursor: 'pointer', color: '#ffffff', background: 'rgba(0,204,255,0.14)', border: `1px solid ${CYAN}`,
        }}
      >
        DONE [ESC]
      </button>
    </div>
  )
}

function Slider({ id, label, value, onChange, disabled }: {
  id: string; label: string; value: number; onChange: (v: number) => void; disabled: boolean
}) {
  const pct = Math.round(value * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.45 : 1 }}>
      <label htmlFor={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, letterSpacing: 2 }}>
        <span>{label}</span>
        <span style={{ color: CYAN, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </label>
      <input
        id={id}
        className="bl-range"
        type="range" min={0} max={100} step={5}
        value={pct}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </div>
  )
}
