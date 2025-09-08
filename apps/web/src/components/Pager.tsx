import React from 'react'

type PagerProps = {
  canFirst: boolean
  canPrev: boolean
  canNext: boolean
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  className?: string
}

export function Pager({ canFirst, canPrev, canNext, onFirst, onPrev, onNext, className = '' }: PagerProps){
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button disabled={!canFirst} onClick={onFirst} className="btn disabled:opacity-50" title="First page">First</button>
      <button disabled={!canPrev} onClick={onPrev} className="btn disabled:opacity-50" title="Previous page">Prev</button>
      <button disabled={!canNext} onClick={onNext} className="btn disabled:opacity-50" title="Next page">Next</button>
    </div>
  )
}
