'use client'

import { useEffect, useRef, useState } from 'react'

// Terminal-style count-up: value ticks from 0 when the tile scrolls into view
export default function StatCounter({
  value,
  prefix = '',
  decimals = 0,
  durationMs = 1200,
}: {
  value: number
  prefix?: string
  decimals?: number
  durationMs?: number
}) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return
        started.current = true

        const t0 = performance.now()
        const tick = (t: number) => {
          const p = Math.min((t - t0) / durationMs, 1)
          // ease-out cubic — fast start, settles like a terminal readout
          const eased = 1 - Math.pow(1 - p, 3)
          setDisplay(value * eased)
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [value, durationMs])

  return (
    <span ref={ref}>
      {prefix}
      {display.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  )
}
