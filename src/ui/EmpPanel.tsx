import { useGameStore } from '../store/gameStore'

const CYAN = '#33eeff'
// Touch players use the on-screen button, so key hints are noise there.
const IS_TOUCH = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)

const label = {
  fontFamily: 'monospace', fontSize: 13, letterSpacing: 2,
  textShadow: '0 0 4px #000', whiteSpace: 'nowrap' as const,
}

/** The EMP gauge: fills from absorbed energy, reads READY when full and the
 *  minimum gap since the last pulse is over. Pulses on every absorb (keyed
 *  by catchSerial). */
export function EmpPanel({ width }: { width: number | string }) {
  const core = useGameStore((s) => s.core)
  const gap = core.energy >= 100 && !core.ready
  const status = core.ready ? (IS_TOUCH ? 'READY' : 'READY  [E]') : gap ? 'RECHARGING' : `${core.energy}%`

  return (
    <div style={{ width, pointerEvents: 'none', userSelect: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <style>{`
        @keyframes empBlink { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes empJump {
          0%   { transform: scaleY(1.9); filter: brightness(2.2); }
          100% { transform: scaleY(1);   filter: brightness(1); }
        }
      `}</style>
      <div style={{ ...label, display: 'flex', justifyContent: 'space-between', color: CYAN }}>
        <span>EMP</span>
        <span style={{
          color: core.ready ? '#ffffff' : gap ? '#7aa6b0' : CYAN,
          textShadow: core.ready ? `0 0 10px ${CYAN}` : label.textShadow,
          animation: core.ready ? 'empBlink 0.7s linear infinite' : undefined,
        }}>
          {status}
        </span>
      </div>
      <div style={{ position: 'relative', height: 11, background: 'rgba(255,255,255,0.10)', borderRadius: 4, overflow: 'hidden' }}>
        <div
          key={core.catchSerial}
          style={{
            height: '100%', width: `${core.energy}%`, background: CYAN, borderRadius: 4,
            boxShadow: core.ready ? `0 0 12px ${CYAN}` : undefined,
            transition: 'width 0.12s ease-out',
            animation: core.catchSerial ? 'empJump 0.22s ease-out' : undefined,
          }}
        />
        {/* the minimum gap between pulses sweeps across a full gauge */}
        {gap && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(1 - core.empCharge) * 100}%`,
            background: 'rgba(8,14,26,0.65)', transition: 'width 0.05s linear',
          }} />
        )}
      </div>
    </div>
  )
}
