import { useGameStore } from '../store/gameStore'
import { STAGE_W, PLAYFIELD_W, PLAYFIELD_LEFT, PLAYFIELD_RIGHT } from '../game/config'
import { stageConfig } from '../game/data/stages'
import { HULL } from '../game/data/chase'
import { SPEAKERS } from '../game/data/story'
import { EmpPanel } from './EmpPanel'

const IS_TOUCH = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)

/** Touch buttons drive the same key path the keyboard does, so InputSystem
 *  stays the single place that knows what an action is. */
function tapKey(code: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
  setTimeout(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
  }, 120)
}

// Landscape runs a central combat corridor with decorative side wings, so the
// HUD moves out into those wings instead of sitting over the playfield.
const IS_WIDE = PLAYFIELD_W < STAGE_W
const WING_W = PLAYFIELD_LEFT

const mono = {
  color: '#fff', fontFamily: 'monospace', fontSize: 13,
  pointerEvents: 'none' as const, userSelect: 'none' as const,
  textShadow: '0 0 4px #000',
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Hull, the stage clock and objective, the EMP gauge (design v0.2 §5). */
export function HUD() {
  const { hull, timeLeft, duration, stage, soundEnabled, toggleSound } = useGameStore()
  const mission = stageConfig(stage).mission
  const urgent = timeLeft <= 10
  const progress = Math.min(1, Math.max(0, 1 - timeLeft / duration))

  const soundButton = (
    <button
      // Blur after click so a focused button isn't re-triggered by Space,
      // which is a game key.
      onClick={(e) => { toggleSound(); e.currentTarget.blur() }}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.preventDefault() }}
      title="Toggle sound (M)"
      style={{
        pointerEvents: 'all', background: 'rgba(0,0,0,0.5)', border: '1px solid #444', borderRadius: 4,
        color: '#fff', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, lineHeight: 1,
        padding: '2px 6px', userSelect: 'none',
      }}
    >
      {soundEnabled ? '🔊' : '🔇'}
    </button>
  )

  const hullPips = (
    <span style={{ letterSpacing: 3 }}>
      <span style={{ color: '#8899aa', letterSpacing: 2, marginRight: 6 }}>HULL</span>
      <span style={{ color: hull <= 1 ? '#ff5544' : '#ffd25a' }}>{'◆'.repeat(hull)}</span>
      <span style={{ color: '#4a4f5c' }}>{'◇'.repeat(Math.max(0, HULL.max - hull))}</span>
    </span>
  )

  const timer = (size: number) => (
    <span style={{
      fontSize: size, fontWeight: 'bold', letterSpacing: 2, fontVariantNumeric: 'tabular-nums',
      color: urgent ? '#ffdd55' : '#ffffff',
      textShadow: urgent ? '0 0 12px #ffaa00' : '0 0 8px #0088ff',
    }}>
      {clock(timeLeft)}
    </span>
  )

  const progressBar = (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${progress * 100}%`, background: '#7ff3ff', transition: 'width 0.3s linear' }} />
    </div>
  )

  return (
    <>
      {IS_WIDE ? (
        <>
          {/* Left wing: the objective and the clock */}
          <div style={{
            position: 'absolute', top: 14, left: 0, width: WING_W, padding: '0 14px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start', ...mono,
          }}>
            <span style={{ color: '#88aacc', letterSpacing: 3 }}>STAGE {stage}</span>
            <span style={{ fontSize: 15 }}>{mission}</span>
            {timer(34)}
            <div style={{ width: Math.min(220, WING_W - 28) }}>{progressBar}</div>
          </div>

          {/* Right wing: hull and the EMP */}
          <div style={{
            position: 'absolute', top: 14, left: PLAYFIELD_RIGHT, width: WING_W, padding: '0 14px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end', ...mono,
          }}>
            {hullPips}
            <span style={{ pointerEvents: 'all' }}>{soundButton}</span>
            <div style={{ marginTop: 6, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <EmpPanel width={Math.min(300, WING_W - 28)} />
            </div>
          </div>
        </>
      ) : (
        // Portrait: everything along the top edge, away from the pursuers
        // coming in at the bottom.
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', padding: '6px 10px', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: 5, ...mono,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {hullPips}
            {timer(22)}
            {soundButton}
          </div>
          {progressBar}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#aabbcc', paddingTop: 2 }}>{mission}</span>
            <EmpPanel width={170} />
          </div>
        </div>
      )}

      {IS_TOUCH && <EmpButton />}
      <RadioLine />
    </>
  )
}

/** One big EMP button; lit when the pulse is ready. */
function EmpButton() {
  const phase = useGameStore((s) => s.phase)
  const ready = useGameStore((s) => s.core.ready)
  // Only in play: over the title it would sit on the menu.
  if (phase !== 'playing') return null
  const color = '#33eeff'
  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); tapKey('KeyE') }}
      style={{
        position: 'absolute', bottom: 22, right: 16, width: 84, height: 84, borderRadius: '50%',
        background: ready ? `${color}55` : 'rgba(0,0,0,0.3)', border: `2px solid ${ready ? color : '#3a5560'}`,
        color: ready ? '#fff' : '#6a8a94', boxShadow: ready ? `0 0 18px ${color}` : undefined,
        fontFamily: 'monospace', fontSize: 15, fontWeight: 'bold', letterSpacing: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', touchAction: 'none', zIndex: 10, pointerEvents: 'auto',
      }}
    >
      EMP
    </button>
  )
}

/** Short radio lines and prompts: never block, centered on the corridor
 *  just under the top HUD. */
function RadioLine() {
  const hint = useGameStore((s) => s.hint)
  const phase = useGameStore((s) => s.phase)
  if (!hint || phase !== 'playing') return null
  const color = hint.tone === 'warn' ? '#ff8a4d' : '#7ff3ff'
  const who = hint.who ? SPEAKERS[hint.who] : null
  return (
    <div key={hint.id} style={{
      position: 'absolute', top: IS_WIDE ? 18 : 96, left: PLAYFIELD_LEFT, width: PLAYFIELD_W,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none',
    }}>
      <style>{`
        @keyframes radioIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, maxWidth: '92%',
        fontFamily: '"Noto Sans TC", system-ui, sans-serif', fontSize: 15, letterSpacing: 1, color: '#f2ede2',
        padding: '7px 14px', background: 'rgba(0,8,20,0.78)',
        border: `1px solid ${who ? who.color : color}`, borderRadius: 4,
        animation: 'radioIn 0.25s ease-out',
      }}>
        {who && (
          <span style={{
            flex: 'none', fontWeight: 900, fontSize: 13, padding: '1px 8px',
            background: who.color, color: '#140e08',
          }}>
            {who.name}
          </span>
        )}
        <span style={who ? undefined : { fontFamily: 'monospace', color, letterSpacing: 2, textShadow: `0 0 8px ${color}` }}>
          {hint.text}
        </span>
      </div>
    </div>
  )
}
