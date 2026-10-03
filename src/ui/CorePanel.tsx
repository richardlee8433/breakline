import { useGameStore } from '../store/gameStore'
import { BOMB, ENERGY } from '../game/data/core'

const CYAN = '#33eeff'
// Touch players use on-screen buttons, so key hints are noise there — and
// they don't fit the narrow portrait panel.
const IS_TOUCH = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)
const key = (k: string) => (IS_TOUCH ? '' : ` [${k}]`)
// One tick per gun level: the bar reads as five steps, not a smooth gauge.
const LEVEL_TICKS = Array.from({ length: Math.floor(ENERGY.max / ENERGY.perLevel) - 1 },
  (_, i) => ((i + 1) * ENERGY.perLevel / ENERGY.max) * 100)

const label = {
  fontFamily: 'monospace', fontSize: 13, letterSpacing: 2,
  textShadow: '0 0 4px #000', whiteSpace: 'nowrap' as const,
}

/** Energy (gun level + shield), heat, bombs and the two cooldowns. Bars ease
 *  with CSS transitions; the energy bar replays a short pulse on every catch
 *  (keyed by catchSerial). */
export function CorePanel({ width }: { width: number | string }) {
  const core = useGameStore((s) => s.core)
  const enabled = useGameStore((s) => s.coreEnabled)
  const bombs = useGameStore((s) => s.bombs)
  const shieldUp = core.shield > 0
  const heatColor = core.overheated ? '#ff3b2f' : core.heat > 70 ? '#ff8a33' : '#ffc14d'

  return (
    <div style={{ width, pointerEvents: 'none', userSelect: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <style>{`
        @keyframes coreBlink { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes energyJump {
          0%   { transform: scaleY(1.9); filter: brightness(2.2); }
          100% { transform: scaleY(1);   filter: brightness(1); }
        }
      `}</style>

      {enabled ? (
        <>
          <div style={{ ...label, display: 'flex', justifyContent: 'space-between', color: CYAN }}>
            <span>GUN LV {core.level + 1}</span>
            <span style={{
              color: shieldUp ? '#ffffff' : '#3a6f80',
              textShadow: shieldUp ? `0 0 8px ${CYAN}` : label.textShadow,
            }}>
              SHIELD {shieldUp ? '◆'.repeat(core.shield) : '—'}
            </span>
          </div>
          <div style={{ position: 'relative', height: 11, background: 'rgba(255,255,255,0.10)', borderRadius: 4 }}>
            <div
              key={core.catchSerial}
              style={{
                height: '100%', width: `${core.energy}%`, background: CYAN, borderRadius: 4,
                boxShadow: shieldUp ? `0 0 10px ${CYAN}` : undefined,
                transition: 'width 0.12s ease-out',
                animation: core.catchSerial ? 'energyJump 0.22s ease-out' : undefined,
              }}
            />
            {LEVEL_TICKS.map((pct) => (
              <div key={pct} style={{
                position: 'absolute', top: -2, bottom: -2, left: `${pct}%`, width: 2,
                background: '#0b1220', opacity: 0.9,
              }} />
            ))}
          </div>

          <div style={{ ...label, display: 'flex', justifyContent: 'space-between', color: heatColor }}>
            <span>HEAT</span>
            {core.overheated && (
              <span style={{ animation: 'coreBlink 0.35s linear infinite' }}>OVERHEAT</span>
            )}
          </div>
          <div style={{ height: 7, background: 'rgba(255,255,255,0.10)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${core.heat}%`, background: heatColor,
              transition: 'width 0.1s linear',
            }} />
          </div>
        </>
      ) : (
        <div style={{ ...label, color: '#667788' }}>CORE OFFLINE · CONTROL RUN</div>
      )}

      <div style={{ ...label, display: 'flex', justifyContent: 'space-between', color: bombs ? '#ffcf5a' : '#6a6050' }}>
        <span>{`BOMB${key('E')}`}</span>
        <span style={{ letterSpacing: 4 }}>{'●'.repeat(bombs)}{'○'.repeat(Math.max(0, BOMB.max - bombs))}</span>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {enabled && (
          <Chip
            text={core.overheated ? 'LOCKED' : core.absorbing ? 'CATCH!' : `ABSORB${key('SHIFT')}`}
            charge={core.overheated ? 0 : core.absorbCharge}
            color={core.overheated ? '#ff3b2f' : CYAN}
            lit={core.absorbing}
          />
        )}
         <Chip text={`DASH${key('SPACE')}`} charge={core.dashCharge} color="#b9a6ff" lit={false} />
      </div>
    </div>
  )
}

function Chip({ text, charge, color, lit }: { text: string; charge: number; color: string; lit: boolean }) {
  const ready = charge >= 1
  return (
    <div style={{
      ...label, flex: 1, position: 'relative', overflow: 'hidden',
      fontSize: 12, letterSpacing: 1, textAlign: 'center', padding: '5px 4px',
      border: `1px solid ${ready || lit ? color : 'rgba(255,255,255,0.18)'}`, borderRadius: 3,
      color: ready || lit ? '#fff' : '#778',
      background: lit ? `${color}55` : 'rgba(0,0,0,0.35)',
    }}>
      {/* cooldown fill sweeps left → right */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: `${charge * 100}%`,
        background: `${color}22`, transition: 'width 0.05s linear',
      }} />
      <span style={{ position: 'relative' }}>{text}</span>
    </div>
  )
}
