import React, { useState, useRef, useEffect } from 'react'

type TooltipProps = {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
  placement?: 'top' | 'bottom'
  delay?: number
}

export function Tooltip({ content, children, className = '', placement = 'top', delay = 150 }: TooltipProps){
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const tRef = useRef<number | undefined>()
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  useEffect(()=> () => { if (tRef.current) window.clearTimeout(tRef.current) }, [])
  function show(){ tRef.current = window.setTimeout(()=> { setOpen(true); setReady(true) }, delay) }
  function hide(){ if (tRef.current) window.clearTimeout(tRef.current); setOpen(false) }
  return (
    <span ref={wrapRef} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} className={`tooltip-trigger ${className}`}>
      {children}
      {ready && (
        <span className={`tooltip-bubble ${open? 'opacity-100 scale-100':'opacity-0 scale-95'} ${placement==='bottom' ? 'mt-2 origin-top':'mb-2 origin-bottom'}`}>{content}</span>
      )}
    </span>
  )
}
