import { useEffect, useRef } from 'react'
import { useVoice } from '../lib/VoiceContext'

interface Props {
  /** 'bar' = horizontal bar, 'dots' = segmented dots */
  variant?: 'bar' | 'dots'
  className?: string
}

export default function MicLevelMeter({ variant = 'bar', className = '' }: Props) {
  const { getMicLevel, isInVoice, isMuted } = useVoice()
  const barRef = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!isInVoice) return

    const animate = () => {
      const level = isMuted ? 0 : getMicLevel()

      if (variant === 'bar' && barRef.current) {
        barRef.current.style.width = `${level}%`
        // Color transitions: green -> yellow -> red
        if (level < 40) {
          barRef.current.style.background = 'rgb(74, 222, 128)'
        } else if (level < 70) {
          barRef.current.style.background = 'rgb(250, 204, 21)'
        } else {
          barRef.current.style.background = 'rgb(248, 113, 113)'
        }
      }

      if (variant === 'dots' && dotsRef.current) {
        const dots = dotsRef.current.children
        for (let i = 0; i < dots.length; i++) {
          const threshold = (i / dots.length) * 100
          const dot = dots[i] as HTMLElement
          if (level > threshold) {
            if (i < 3) dot.style.background = 'rgb(74, 222, 128)'
            else if (i < 4) dot.style.background = 'rgb(250, 204, 21)'
            else dot.style.background = 'rgb(248, 113, 113)'
            dot.style.opacity = '1'
          } else {
            dot.style.background = 'rgba(255, 255, 255, 0.1)'
            dot.style.opacity = '0.5'
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isInVoice, isMuted, getMicLevel, variant])

  if (!isInVoice) return null

  if (variant === 'dots') {
    return (
      <div ref={dotsRef} className={`flex items-center gap-0.5 ${className}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-75"
            style={{
              height: `${8 + i * 2}px`,
              background: 'rgba(255, 255, 255, 0.1)',
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`h-1.5 rounded-full bg-white/[0.06] overflow-hidden ${className}`}>
      <div
        ref={barRef}
        className="h-full rounded-full transition-[width] duration-75"
        style={{ width: '0%', background: 'rgb(74, 222, 128)' }}
      />
    </div>
  )
}
