import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { SCENES, SPEAKERS } from '../game/data/story'
import { portraitURL, PORTRAITS, PortraitId } from '../art/portraits'
import { PLAYFIELD_LEFT, PLAYFIELD_W, SPRITE_SCALE, STAGE_W } from '../game/config'

const CPS = 28   // characters typed per second (Lastlight's zh rate)
// Low on the screen, visual-novel style. Combat is paused and the HUD fades
// out while a scene plays, so nothing underneath needs to stay visible.
const BOX_BOTTOM = PLAYFIELD_W < STAGE_W ? 64 * SPRITE_SCALE : 28

// Story dialog, ported from Lastlight (lastlight-colony src/ui/Dialog.tsx +
// the .dlg rules in styles.css): a bust portrait overlapping the bottom-left
// of the text box, a name tag in the speaker's colour, typewriter text. Click,
// tap, Space or Enter finishes the line, then advances; Skip (or Esc) ends the
// scene. Combat is paused while it is up (GameApp only ticks in 'playing').
export function StoryDialog() {
  const scene = useGameStore((s) => s.storyScene)
  const talk = useGameStore((s) => s.talk)
  const finishScene = useGameStore((s) => s.finishScene)
  const finishTalk = useGameStore((s) => s.finishTalk)
  // A between-stage scene (phase 'story') or an in-combat talk.
  const id = scene ?? talk
  if (!id) return null
  return <Scene key={id} id={id} onDone={scene ? finishScene : finishTalk} />
}

function Scene({ id, onDone: finishScene }: { id: keyof typeof SCENES; onDone: () => void }) {
  const { heading, lines } = SCENES[id]
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(0)
  const [who, text] = lines[i]
  const typing = shown < text.length

  useEffect(() => {
    if (!typing) return
    const step = setInterval(() => setShown((n) => Math.min(text.length, n + 1)), 1000 / CPS)
    return () => clearInterval(step)
  }, [typing, text])

  const next = () => {
    if (typing) return setShown(text.length)
    if (i + 1 < lines.length) { setI(i + 1); setShown(0) } else finishScene()
  }

  // Attach the key listener once and reach the latest `next` through a ref.
  // Re-attaching it on every render (the obvious way) loses keys: another
  // keydown handler can update the store mid-dispatch, React re-renders
  // synchronously, and a listener removed during dispatch is never called.
  const nextRef = useRef(next)
  nextRef.current = next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); nextRef.current() }
      if (e.code === 'Escape') finishScene()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finishScene])

  const hasArt = who in PORTRAITS
  const speaker = SPEAKERS[who]
  return (
    <div
      className="dlg-root"
      onPointerDown={(e) => e.stopPropagation()}
      style={{ ['--k' as string]: SPRITE_SCALE, ['--who' as string]: speaker.color }}
    >
      <style>{DLG_CSS}</style>
      <div className="dlg-veil" onClick={next} aria-hidden="true" />
      {heading && <div className="dlg-heading" key={heading}>{heading}</div>}
      <div
        className={'dlg who-' + who + (hasArt ? '' : ' plain')}
        role="dialog"
        aria-label="Dialogue"
        style={{ left: PLAYFIELD_LEFT + 12 * SPRITE_SCALE, width: PLAYFIELD_W - 24 * SPRITE_SCALE, bottom: BOX_BOTTOM }}
      >
        {hasArt && (
          <img key={who} className="dlg-art" src={portraitURL(who as PortraitId)} alt="" draggable={false} />
        )}
        <div
          className="dlg-box px" onClick={next} role="button" tabIndex={0} aria-label="Next line"
        >
          {speaker.name && <span className="dlg-name">{speaker.name}</span>}
          <p aria-live="polite">
            {text.slice(0, shown)}
            <span className="dlg-rest" aria-hidden="true">{text.slice(shown)}</span>
          </p>
          {!typing && <i className="dlg-arrow" aria-hidden="true">▼</i>}
          <span className="dlg-count">{i + 1}/{lines.length}</span>
        </div>
        <button type="button" className="dlg-skip" onClick={finishScene}>跳過 ▸▸</button>
      </div>
    </div>
  )
}

// Lastlight's dialog rules, with every length multiplied by --k so the box
// keeps its proportions on the wide landscape stage (k = 1.5) and on phones
// (k = 1). Colours are Lastlight's tokens.
const DLG_CSS = `
.dlg-root {
  --ink: #0b0d14; --edge: #0c0d14; --bevel: #5c6580; --shade: #141824;
  --text: #f2ede2; --muted: #a7a2b6;
  position: absolute; inset: 0; z-index: 30;
  font-family: "Noto Sans TC", system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif;
}
.dlg-root .px {
  border: 2px solid var(--edge);
  box-shadow: inset 2px 2px 0 var(--bevel), inset -2px -2px 0 var(--shade), 0 3px 0 rgba(0, 0, 0, 0.35);
}
.dlg-veil { position: absolute; inset: 0; background: rgba(6, 7, 14, 0.45); cursor: pointer; animation: veil-in 0.3s ease-out; }
@keyframes veil-in { from { opacity: 0; } }
.dlg-heading {
  position: absolute; left: 0; right: 0; top: 22%; text-align: center; pointer-events: none;
  font: 900 calc(var(--k) * 26px) / 1 monospace; letter-spacing: 0.3em; color: #7ff3ff;
  text-shadow: 0 0 18px #00ccff; animation: dlg-in 0.4s ease-out;
}
.dlg { position: absolute; pointer-events: none; animation: dlg-in 0.25s ease-out; }
.dlg-art {
  position: absolute; left: calc(var(--k) * -6px); bottom: calc(var(--k) * 10px);
  width: calc(var(--k) * 128px); height: calc(var(--k) * 160px); z-index: 1;
  image-rendering: pixelated; filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.45)); animation: dlg-art 0.3s ease-out;
}
.dlg-box {
  position: relative; pointer-events: auto; cursor: pointer;
  min-height: calc(var(--k) * 96px);
  padding: calc(var(--k) * 20px) calc(var(--k) * 18px) calc(var(--k) * 14px) calc(var(--k) * 134px);
  background: rgba(20, 23, 35, 0.94);
}
.dlg-box:focus-visible { outline: 2px solid var(--who); outline-offset: 2px; }
.dlg-box p { margin: 0; font-size: calc(var(--k) * 15px); line-height: 1.7; color: var(--text); min-height: 3.4em; }
.dlg-rest { visibility: hidden; }
.dlg-name {
  position: absolute; top: calc(var(--k) * -14px); left: calc(var(--k) * 124px);
  padding: calc(var(--k) * 2px) calc(var(--k) * 12px);
  font-weight: 900; font-size: calc(var(--k) * 14px); letter-spacing: 0.06em;
  background: var(--who); color: #140e08; border: 2px solid var(--edge);
  box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.35);
}
.dlg-arrow {
  position: absolute; right: calc(var(--k) * 14px); bottom: calc(var(--k) * 7px);
  font-style: normal; font-size: calc(var(--k) * 12px); color: var(--who); animation: dlg-bob 0.9s ease-in-out infinite;
}
.dlg-count {
  position: absolute; right: calc(var(--k) * 34px); bottom: calc(var(--k) * 6px);
  font-size: calc(var(--k) * 11px); color: var(--muted); font-variant-numeric: tabular-nums;
}
.dlg-skip {
  position: absolute; right: 0; top: calc(var(--k) * -32px); pointer-events: auto; appearance: none; border: 0;
  background: rgba(12, 13, 20, 0.75); color: var(--muted); font: inherit;
  font-size: calc(var(--k) * 12px); padding: calc(var(--k) * 4px) calc(var(--k) * 10px); cursor: pointer;
}
.dlg-skip:hover { color: var(--text); }
.dlg.plain .dlg-box { padding-left: calc(var(--k) * 18px); }
.dlg.plain .dlg-name { left: calc(var(--k) * 10px); }
.dlg.who-narr .dlg-box p { font-style: italic; color: var(--muted); }
@keyframes dlg-in { from { transform: translateY(10px); opacity: 0; } }
@keyframes dlg-art { from { transform: translateX(-16px); opacity: 0; } }
@keyframes dlg-bob { 50% { transform: translateY(3px); } }
@media (prefers-reduced-motion: reduce) { .dlg, .dlg-art, .dlg-arrow, .dlg-heading { animation: none; } }
`
