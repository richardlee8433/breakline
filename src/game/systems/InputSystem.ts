export interface Actions {
  moveX: number  // -1 | 0 | 1 (keyboard)
  moveY: number  // -1 | 0 | 1 (keyboard)
  fire: boolean
  bomb: boolean
  focus: boolean // slow precise movement, shows hitbox dot
  // Touch drag deltas in canvas pixels, consumed each frame
  touchDX: number
  touchDY: number
  touchActive: boolean
}

const TOUCH_SENSITIVITY = 1.6

export class InputSystem {
  private keys = new Set<string>()
  readonly actions: Actions = {
    moveX: 0, moveY: 0, fire: false, bomb: false, focus: false,
    touchDX: 0, touchDY: 0, touchActive: false,
  }

  private pointerId: number | null = null
  private lastX = 0
  private lastY = 0
  private accDX = 0
  private accDY = 0
  private touching = false
  private canvasScale = 1

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code)
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    if (this.pointerId !== null) return
    this.pointerId = e.pointerId
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.touching = true
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return
    this.accDX += (e.clientX - this.lastX) / this.canvasScale
    this.accDY += (e.clientY - this.lastY) / this.canvasScale
    this.lastX = e.clientX
    this.lastY = e.clientY
  }

  private onPointerEnd = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return
    this.pointerId = null
    this.touching = false
  }

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerEnd)
    window.addEventListener('pointercancel', this.onPointerEnd)
  }

  /** Canvas CSS scale factor so touch deltas map 1:1 to game pixels */
  setCanvasScale(s: number) {
    this.canvasScale = s || 1
  }

  update() {
    const k = this.keys
    this.actions.moveX =
      (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) -
      (k.has('ArrowLeft')  || k.has('KeyA') ? 1 : 0)
    this.actions.moveY =
      (k.has('ArrowDown')  || k.has('KeyS') ? 1 : 0) -
      (k.has('ArrowUp')    || k.has('KeyW') ? 1 : 0)
    this.actions.fire = k.has('Space') || this.touching
    this.actions.bomb = k.has('KeyX') || k.has('KeyB')
    this.actions.focus = k.has('ShiftLeft') || k.has('ShiftRight')

    this.actions.touchActive = this.touching
    this.actions.touchDX = this.accDX * TOUCH_SENSITIVITY
    this.actions.touchDY = this.accDY * TOUCH_SENSITIVITY
    this.accDX = 0
    this.accDY = 0
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerEnd)
    window.removeEventListener('pointercancel', this.onPointerEnd)
  }
}
