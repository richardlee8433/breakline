import { useGameStore } from '../store/gameStore'
import { COUNTER, ENERGY } from '../game/data/core'

const CYAN = '#33eeff'
// Touch players use on-screen buttons, so key hints are noise there — and
// they don't fit the narrow portrait panel.
const IS_TOUCH = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)
const key = (k: string) => (IS_TOUCH ? '' : ` [${k}]`)
const COUNTER_PCT = (COUNTER.cost / ENERGY.max) * 100

const label = {
  fontFamily: 'monospace', fontSize: 13, letterSpacing: 2,
  textShadow: '0 0 4px #000', whiteSpace: 'nowrap' as const,
}

/** Energy, heat and the two cooldowns. Bars ease with CSS transitions; the
 *  energy bar replays a short pulse on every catch (keyed by catchSerial). */
export function CorePanel({ width }: { width: number | string }) {
  const core = useGameStore((s) => s.core)
  const enabled = useGameStore((s) => s.coreEnabled)
  const counterReady = core.energy >= COUNTER.cost
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
            <span>ENERGY</span>
            <span style={{
              color: counterReady ? '#ffffff' : '#3a6f80',
              textShadow: counterReady ? `0 0 8px ${CYAN}` : label.textShadow,
            }}>
              {`COUNTER${key('E')}`}
            </span>
          </div>
          <div style={{ position: 'relative', height: 11, background: 'rgba(255,255,255,0.10)', borderRadius: 4 }}>
            <div
              key={core.catchSerial}
              style={{
                height: '100%', width: `${core.energy}%`, background: CYAN, borderRadius: 4,
                boxShadow: counterReady ? `0 0 10px ${CYAN}` : undefined,
                transition: 'width 0.12s ease-out',
                animation: core.catchSerial ? 'energyJump 0.22s ease-out' : undefined,
              }}
            />
            {/* counter threshold tick */}
            <div style={{
              position: 'absolute', top: -3, bottom: -3, left: `${COUNTER_PCT}%`, width: 2,
              background: '#ffffff', opacity: 0.7,
            }} />
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
