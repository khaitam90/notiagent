import { useEffect, useState } from 'react'

type Props = {
  axis: 'x' | 'y'
  onDelta: (delta: number) => void
  className?: string
}

export default function ResizeHandle({ axis, onDelta, className = '' }: Props) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return
    document.body.classList.add('is-resizing', axis === 'x' ? 'resize-col' : 'resize-row')
    const onMove = (e: PointerEvent) => {
      onDelta(axis === 'x' ? e.movementX : e.movementY)
    }
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('is-resizing', axis === 'x' ? 'resize-col' : 'resize-row')
    }
  }, [dragging, axis, onDelta])

  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      tabIndex={0}
      className={`resize-handle resize-handle-${axis === 'x' ? 'v' : 'h'}${dragging ? ' dragging' : ''} ${className}`.trim()}
      onPointerDown={(e) => {
        e.preventDefault()
        setDragging(true)
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
    />
  )
}
