import { useEffect, useRef, useState } from 'react'
import { GameApp } from './game/core/GameApp'
import { HUD } from './ui/HUD'
import { TitleScreen } from './ui/TitleScreen'
import { GameOverScreen } from './ui/GameOverScreen'
import { StageClearScreen } from './ui/StageClearScreen'
import { StoryDialog } from './ui/StoryDialog'
import { useGameStore } from './store/gameStore'

import { STAGE_W as GAME_W, STAGE_H as GAME_H } from './game/config'

export default function App() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const gameRef      = useRef<GameApp | null>(null)
  const phase        = useGameStore((s) => s.phase)
  const paused       = useGameStore((s) => s.paused)
  const toggleSound  = useGameStore((s) => s.toggleSound)
  const togglePause  = useGameStore((s) => s.togglePause)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!canvasRef.current || gameRef.current) return
    const game = new GameApp(canvasRef.current)
    gameRef.current = game
    game.init().catch(console.error)
    return () => { game.destroy(); gameRef.current = null }
  }, [])

  // Fill the viewport: scale up or down to the container (VIVERSE iframe,
  // desktop window, phone) — a portrait shmup fills the height on wide
  // screens and the width on tall ones.
  useEffect(() => {
    const onResize = () => {
      const s = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H)
      setScale(s)
      gameRef.current?.setCanvasScale(s)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 'M' toggles mute, 'P' / Escape toggles pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') toggleSound()
      if (e.code === 'KeyP' || e.code === 'Escape') togglePause()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSound, togglePause])

  // Touch play is one long drag, which mobile browsers read as a text
  // selection or a long-press: iOS pops its Copy/Look Up callout mid-fight.
  // Block selection, the long-press menu and pinch-zoom for the whole page.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    const events = ['selectstart', 'contextmenu', 'gesturestart', 'dragstart']
    for (const ev of events) document.addEventListener(ev, block, { passive: false })
    return () => { for (const ev of events) document.removeEventListener(ev, block) }
  }, [])

  return (
    <div style={{
      position: 'absolute', width: GAME_W, height: GAME_H,
      left: '50%', top: '50%',
      marginLeft: -(GAME_W / 2), marginTop: -(GAME_H / 2),
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
      touchAction: 'none',
    }}>
      {/* iOS Safari honours only the prefixed user-select, and needs
          touch-callout off to stop the long-press menu. */}
      <style>{`
        html, body, #root, #root * {
          -webkit-user-select: none; user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
      <canvas
        ref={canvasRef}
        width={GAME_W}
        height={GAME_H}
        style={{ display: 'block', touchAction: 'none', imageRendering: 'pixelated' }}
      />
      {/* The HUD steps back while a story scene plays: combat is paused, and
          the scene reads better without meters over it. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: phase === 'story' ? 0 : 1, transition: 'opacity 0.35s ease',
      }}>
        <HUD />
      </div>
      {phase === 'title'      && <TitleScreen />}
      {phase === 'gameover'   && <GameOverScreen />}
      {phase === 'complete'   && <GameOverScreen cleared />}
      {phase === 'stageclear' && <StageClearScreen />}
      {phase === 'story'      && <StoryDialog />}
      {paused && phase === 'playing' && (
        <div
          onClick={togglePause}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,10,0.72)',
            color: '#fff', fontFamily: 'monospace',
            userSelect: 'none', cursor: 'pointer', zIndex: 20,
          }}
        >
          <div style={{
            fontSize: 40, letterSpacing: 10, fontWeight: 'bold',
            textShadow: '0 0 16px #44ddff',
          }}>
            PAUSED
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: '#88aacc', letterSpacing: 3 }}>
            PRESS P / ESC OR TAP TO RESUME
          </div>
        </div>
      )}
    </div>
  )
}
