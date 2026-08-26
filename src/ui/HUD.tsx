import { useGameStore, chainMult } from '../store/gameStore'
import { STAGE_W, PLAYFIELD_W, PLAYFIELD_LEFT, PLAYFIELD_RIGHT } from '../game/config'
import { BURST_MAX, MAX_BURST_LEVEL, burstTier } from '../game/data/burst'

const IS_TOUCH = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)

// Landscape runs a central combat corridor with decorative side wings, so the
// HUD moves out into those wings instead of sitting over the playfield.
const IS_WIDE = PLAYFIELD_W < STAGE_W
const WING_W = PLAYFIELD_LEFT

/** Touch buttons drive the same key path the keyboard does, so InputSystem
 *  stays the single place that knows what an action is. */
function tapKey(code: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
  setTimeout(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
  }, 120)
}

export function HUD() {
  const { score, hiScore, graze, chain, burst, burstLevel, loop, lives, bombs, weapon,
          bossActive, bossHp, bossMaxHp, bossWarning,
          soundEnabled, toggleSound } = useGameStore()
  const mult = chainMult(chain)
  const chainColor = mult >= 8 ? '#ff44aa' : mult >= 4 ? '#ff9933'
                   : mult >= 2 ? '#ffee44' : '#cccccc'
  const weaponLabel = weapon === 'vulcan' ? 'VULCAN' : weapon === 'laser' ? 'LASER' : 'PLASMA'
  const weaponColor = weapon === 'vulcan' ? '#ff9a33' : weapon === 'laser' ? '#44ddff' : '#ff55ee'
  const weaponLine = (
    <span style={{ color: weaponColor, fontWeight: 'bold', textShadow: `0 0 6px ${weaponColor}` }}>
      {weaponLabel}
    </span>
  )

  const tier = burstTier(burstLevel)
  const burstPct = Math.max(0, Math.min(100, (burst / BURST_MAX) * 100))
  const burstReady = burst >= BURST_MAX && burstLevel < MAX_BURST_LEVEL
  // Idle gauge is cool blue; ready and active states take the tier's accent so
  // "can I burst?" is answerable from peripheral vision mid-dodge.
  const burstColor = burstLevel > 0 ? tier.css
                   : burstReady ? burstTier(1).css : '#3a7fa8'

  const mono = {
    color: '#fff', fontFamily: 'monospace', fontSize: 13,
    pointerEvents: 'none' as const, userSelect: 'none' as const,
    textShadow: '0 0 4px #000',
  }

  const soundButton = (
    <button
      // Blur after click so a focused button doesn't get re-triggered
      // by the spacebar (which is the fire key).
      onClick={(e) => { toggleSound(); e.currentTarget.blur() }}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.preventDefault() }}
      title="Toggle sound (M)"
      style={{
        pointerEvents: 'all',
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid #444',
        borderRadius: 4,
        color: '#fff',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 1,
        padding: '2px 6px',
        userSelect: 'none',
      }}
    >
      {soundEnabled ? '🔊' : '🔇'}
    </button>
  )

  const grazeLine = (
    <div style={{ ...mono, color: '#cc88ff', fontSize: 11 }}>
      GRAZE {graze}{loop > 1 ? `  ·  LOOP ${loop}` : ''}
    </div>
  )

  const chainLine = chain >= 2 && (
    <div style={{
      ...mono,
      color: chainColor,
      fontSize: mult > 1 ? 14 : 11,
      fontWeight: 'bold',
      textShadow: `0 0 6px ${chainColor}`,
      transition: 'font-size 0.15s',
    }}>
      ×{mult} CHAIN {chain}
    </div>
  )

  const burstMeter = (
    <div style={{ width: IS_WIDE ? '100%' : 150, pointerEvents: 'none', userSelect: 'none' }}>
      <style>{`
        @keyframes burstReadyPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
      `}</style>
      <div style={{
        ...mono, fontSize: 10, letterSpacing: 2, marginBottom: 3,
        color: burstColor,
        textShadow: burstLevel > 0 || burstReady ? `0 0 8px ${burstColor}` : '0 0 4px #000',
        animation: burstReady ? 'burstReadyPulse 0.5s linear infinite' : undefined,
      }}>
        {burstLevel > 0 ? tier.label : burstReady ? 'BURST READY  [C]' : 'BURST'}
      </div>
      <div style={{
        width: '100%', height: 7, background: 'rgba(255,255,255,0.10)',
        borderRadius: 4, overflow: 'hidden',
        boxShadow: burstLevel > 0 || burstReady ? `0 0 8px ${burstColor}` : undefined,
      }}>
        <div style={{
          height: '100%', width: `${burstPct}%`, background: burstColor,
          // Only ease the fill, never the drain: a burst has to read as
          // spending down in real time, not lagging a tenth of a second behind.
          transition: burstLevel > 0 ? 'none' : 'width 0.12s linear',
        }} />
      </div>
    </div>
  )

  return (
    <>
      {IS_WIDE ? (
        <>
          {/* Left wing: score & scoring state */}
          <div style={{
            position: 'absolute', top: 14, left: 0, width: WING_W,
            padding: '0 14px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', gap: 7,
            alignItems: 'flex-start', ...mono,
          }}>
            <span>SCORE {String(score).padStart(6, '0')}</span>
            <span style={{ color: '#aab' }}>HI {String(hiScore).padStart(6, '0')}</span>
            {grazeLine}
            {chainLine}
            <div style={{ width: '100%', marginTop: 4 }}>{burstMeter}</div>
          </div>

          {/* Right wing: resources & weapon meters */}
          <div style={{
            position: 'absolute', top: 14, left: PLAYFIELD_RIGHT, width: WING_W,
            padding: '0 14px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', gap: 7,
            alignItems: 'flex-end', ...mono,
          }}>
            <span>{'♥'.repeat(Math.max(0, lives))}</span>
            <span>{'💣'.repeat(Math.max(0, bombs))}</span>
            {weaponLine}
            <span style={{ pointerEvents: 'all', marginTop: 4 }}>{soundButton}</span>
          </div>
        </>
      ) : (
        <>
          {/* Portrait: single top bar across the full width */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%',
            padding: '5px 10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            ...mono,
          }}>
            <span>SCORE {String(score).padStart(6, '0')}</span>
            <span>HI {String(hiScore).padStart(6, '0')}</span>
            <span>{'♥'.repeat(Math.max(0, lives))}{'  '}{'💣'.repeat(Math.max(0, bombs))}</span>
            {weaponLine}
            {soundButton}
          </div>

          <div style={{ position: 'absolute', top: 28, left: 10 }}>{grazeLine}</div>
          <div style={{ position: 'absolute', top: 44, left: 10 }}>{chainLine}</div>
          <div style={{ position: 'absolute', top: 26, right: 10 }}>{burstMeter}</div>
        </>
      )}

      {/* Touch action buttons */}
      {IS_TOUCH && (
        <>
          <button
            onPointerDown={(e) => { e.stopPropagation(); tapKey('KeyX') }}
            style={{
              position: 'absolute', bottom: 18, right: 14,
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(255,60,30,0.30)',
              border: '2px solid rgba(255,120,80,0.7)',
              color: '#fff', fontSize: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              userSelect: 'none', touchAction: 'none',
              zIndex: 10,
            }}
          >
            💣
          </button>
          <button
            onPointerDown={(e) => { e.stopPropagation(); tapKey('KeyC') }}
            style={{
              position: 'absolute', bottom: 92, right: 14,
              width: 64, height: 64, borderRadius: '50%',
              background: burstReady ? 'rgba(255,204,51,0.34)' : 'rgba(60,110,150,0.22)',
              border: `2px solid ${burstReady ? burstColor : 'rgba(120,170,210,0.5)'}`,
              boxShadow: burstReady ? `0 0 16px ${burstColor}` : undefined,
              color: '#fff', fontSize: 12, fontFamily: 'monospace', letterSpacing: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              userSelect: 'none', touchAction: 'none',
              opacity: burstReady || burstLevel > 0 ? 1 : 0.45,
              zIndex: 10,
            }}
          >
            BURST
          </button>
        </>
      )}

      {/* Boss warning banner — centered on the corridor, not the whole stage */}
      {bossWarning && (
        <div style={{
          position: 'absolute', top: '38%',
          left: PLAYFIELD_LEFT, width: PLAYFIELD_W,
          textAlign: 'center', pointerEvents: 'none', userSelect: 'none',
          fontFamily: 'monospace',
        }}>
          <style>{`
            @keyframes warnFlash {
              0%, 100% { opacity: 1; text-shadow: 0 0 24px #ff2200, 0 0 60px #ff2200; }
              50%      { opacity: 0.25; text-shadow: 0 0 8px #ff2200; }
            }
            @keyframes warnSlide {
              from { transform: translateX(-18px); }
              to   { transform: translateX(18px); }
            }
          `}</style>
          <div style={{
            fontSize: 44, fontWeight: 'bold', letterSpacing: 14,
            color: '#ff3322',
            animation: 'warnFlash 0.45s linear infinite',
          }}>
            WARNING
          </div>
          <div style={{
            marginTop: 6, fontSize: 12, letterSpacing: 6, color: '#ff8877',
            animation: 'warnFlash 0.45s linear infinite, warnSlide 0.9s ease-in-out infinite alternate',
          }}>
            A HUGE BATTLESHIP IS APPROACHING
          </div>
        </div>
      )}

      {/* Boss HP bar — centered on the corridor */}
      {bossActive && (
        <div style={{
          position: 'absolute', bottom: 16,
          left: PLAYFIELD_LEFT + PLAYFIELD_W / 2,
          transform: 'translateX(-50%)',
          width: 240,
          pointerEvents: 'none', userSelect: 'none',
          fontFamily: 'monospace', color: '#fff', fontSize: 10,
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: 3, letterSpacing: 2, color: '#ff8888' }}>BOSS</div>
          <div style={{
            width: '100%', height: 10, background: '#333',
            borderRadius: 5, overflow: 'hidden',
            boxShadow: '0 0 6px #ff0000',
          }}>
            <div style={{
              height: '100%',
              width: `${(bossHp / bossMaxHp) * 100}%`,
              background: bossHp / bossMaxHp > 0.5 ? '#00dd44'
                        : bossHp / bossMaxHp > 0.25 ? '#ffaa00' : '#ff2222',
              transition: 'width 0.1s, background 0.3s',
            }} />
          </div>
        </div>
      )}
    </>
  )
}
