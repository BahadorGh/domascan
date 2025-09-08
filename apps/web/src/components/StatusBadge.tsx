import React from 'react'

type StatusBadgeProps = { success: boolean }
export function StatusBadge({ success }: StatusBadgeProps){
  return (
    <span className={`text-xs px-2 py-1 rounded ${success ? 'bg-green-100 text-green-700':'bg-red-100 text-red-700'} dark:${success ? 'bg-green-900/30 text-green-300':'bg-red-900/30 text-red-300'}`}>{success? 'Success':'Fail'}</span>
  )
}
