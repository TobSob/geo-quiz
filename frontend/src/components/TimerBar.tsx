import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Changing this key restarts the countdown. */
  resetKey: number
  timeLimitMs: number
  running: boolean
  onTimeout: () => void
}

export function TimerBar({ resetKey, timeLimitMs, running, onTimeout }: Props) {
  const [fraction, setFraction] = useState(1)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!running) return
    const startedAt = Date.now()
    setFraction(1)
    let raf = 0
    let fired = false
    const tick = () => {
      const remaining = 1 - (Date.now() - startedAt) / timeLimitMs
      setFraction(Math.max(0, remaining))
      if (remaining <= 0) {
        if (!fired) {
          fired = true
          onTimeoutRef.current()
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [resetKey, timeLimitMs, running])

  const cls =
    fraction < 0.2
      ? 'timer-fill timer-fill--danger'
      : fraction < 0.45
        ? 'timer-fill timer-fill--warn'
        : 'timer-fill'

  return (
    <div className="timer-track" aria-label="Zeit">
      <div className={cls} style={{ width: `${fraction * 100}%` }} />
    </div>
  )
}
