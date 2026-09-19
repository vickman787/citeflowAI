'use client'

import { useEffect, useRef, useState } from 'react'

// Terminal-style count-up: value ticks smoothly when in view or when value updates
export default function StatCounter({
  value,
  prefix = '',
  decimals = 0,
  durationMs = 800,
}: {
  value: number
  prefix?: string
  decimals?: number
  durationMs?: number
}) {
  const [display, setDisplay] = useState(value)
  const prevValue = useRef(value)

  useEffect(() => {
    const startVal = prevValue.current
    const endVal = value
    prevValue.current = value

    if (startVal === endVal) {
      setDisplay(endVal)
      return
    }

    const t0 = performance.now()
    let frameId: number

    const tick = (t: number) => {
      const p = Math.min((t - t0) / durationMs, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(startVal + (endVal - startVal) * eased)
      if (p < 1) {
        frameId = requestAnimationFrame(tick)
      } else {
        setDisplay(endVal)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [value, durationMs])

  return (
    <span>
      {prefix}
      {display.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  )
}
