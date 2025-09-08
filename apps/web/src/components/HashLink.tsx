import { Link } from 'react-router-dom'
import { useState } from 'react'

export function truncateHash(h: string, head = 14, tail = 4){
  if (!h) return ''
  return h.length > head + tail + 1 ? h.slice(0, head) + '…' + h.slice(-tail) : h
}

type HashLinkProps = {
  hash: string
  to?: string // optional route path; if omitted renders span
  copy?: boolean
  className?: string
  mono?: boolean
  tooltip?: string
}

export function HashLink({ hash, to, copy = true, className = '', mono = true, tooltip }: HashLinkProps){
  const [copied, setCopied] = useState(false)
  const display = truncateHash(hash)
  const content = (
    <span className={mono ? 'hash-inline' : ''} title={tooltip || hash}>{display}</span>
  )
  async function doCopy(){
    try { await navigator.clipboard.writeText(hash); setCopied(true); setTimeout(()=> setCopied(false), 1200) } catch {}
  }
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}> 
      {to ? <Link to={to} className="text-[#0784c3]">{content}</Link> : content}
      {copy && <button onClick={doCopy} className="hash-btn" title={copied? 'Copied!':'Copy full hash'}>{copied? '✓':'Copy'}</button>}
    </span>
  )
}
