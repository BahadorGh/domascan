import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { apiGet } from '../lib/api'
import { timeAgo } from '../lib/time'
import { HashLink } from '../components/HashLink'
import { StatusBadge } from '../components/StatusBadge'
import { Pager } from '../components/Pager'
import { useDebounce } from '../lib/useDebounce'
import { useQuerySync } from '../lib/useQuerySync'
import { Tooltip } from '../components/Tooltip'

type Tx = { hash: string; createdAt: string; from: string; to?: string | null; success: boolean }
type TxsResp = { items: Tx[]; nextCursor: string | null; prevCursor: string | null }
// trunc + copy handled by HashLink component

export default function Transactions(){
  const [sp] = useSearchParams()
  const [cursor, setCursor] = useState<string | null>(null)
  const [limit, setLimit] = useState(()=> Number(sp.get('limit') || 20))
  const [statusFilter, setStatusFilter] = useState<'all'|'success'|'fail'>(()=> (sp.get('status') as any) || 'all')
  const [fromDate, setFromDate] = useState(()=> sp.get('fromDate') || '')
  const [toDate, setToDate] = useState(()=> sp.get('toDate') || '')
  const [direction, setDirection] = useState<'next'|'prev'>('next')
  const [sort, setSort] = useState<'time_desc'|'time_asc'>(()=> (sp.get('sort') as any) || 'time_desc')
  useEffect(()=> { const l = sp.get('limit'); if(l) setLimit(Number(l)) }, [sp])
  const debouncedFrom = useDebounce(fromDate, 400)
  const debouncedTo = useDebounce(toDate, 400)
  useQuerySync({ limit, status: statusFilter, sort, fromDate: debouncedFrom || undefined, toDate: debouncedTo || undefined })
  const { data, isLoading, isError, refetch } = useQuery<TxsResp>({
    queryKey: ['txs', cursor, limit, statusFilter, direction, sort, debouncedFrom, debouncedTo],
    queryFn: () => apiGet<TxsResp>('/explorer/txs', { limit, cursor: cursor ?? undefined, dir: direction, sort, status: statusFilter==='all'? undefined: statusFilter, fromDate: debouncedFrom || undefined, toDate: debouncedTo || undefined }),
    placeholderData: (prev) => prev,
  })

  let items = data?.items || []
  if (statusFilter !== 'all') items = items.filter(t => (statusFilter === 'success') ? t.success : !t.success)
  const next = data?.nextCursor || null
  const prev = data?.prevCursor || null

  return (
    <div className="space-y-3">
      <div className="table-toolbar">
        <h2 className="text-lg font-semibold">Transactions</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={limit} onChange={e=>{ setCursor(null); setLimit(Number(e.target.value)) }} className="table-select" title="Rows per page">
            {[10,20,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={statusFilter} onChange={e=>{ setCursor(null); setStatusFilter(e.target.value as any) }} className="table-select" title="Status filter">
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="fail">Failed</option>
          </select>
          <input type="date" value={fromDate} onChange={e=> { setCursor(null); setFromDate(e.target.value) }} className="table-filter-input" title="From date" />
          <input type="date" value={toDate} onChange={e=> { setCursor(null); setToDate(e.target.value) }} className="table-filter-input" title="To date" />
          <select value={sort} onChange={e=> { setCursor(null); setSort(e.target.value as any); setDirection('next') }} className="table-select">
            <option value="time_desc">Newest</option>
            <option value="time_asc">Oldest</option>
          </select>
          <button className="btn" onClick={()=> { setCursor(null); refetch() }}>Refresh</button>
        </div>
      </div>
      {isLoading && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 10 }).map((_,i)=>(
                <tr key={i} className="animate-pulse">
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-48" /></td>
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-24" /></td>
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-16" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isError && <p className="text-red-600">Failed to load.</p>}
  <div className="border rounded overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-[#1b2536] text-xs uppercase text-gray-600 dark:text-gray-300">
            <tr>
              <th className="text-left p-2">Txn Hash</th>
              <th className="text-left p-2">Age</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(t => (
              <tr key={t.hash} className="hover:bg-gray-50 dark:hover:bg-[#141c2c]">
                <td className="p-2"><HashLink hash={t.hash} to={`/tx/${t.hash}`} /></td>
                <td className="p-2 text-xs text-gray-500"><Tooltip content={new Date(t.createdAt).toLocaleString()}>{timeAgo(t.createdAt)}</Tooltip></td>
                <td className="p-2"><StatusBadge success={t.success} /></td>
              </tr>
            ))}
            {!items.length && !isLoading && <tr><td colSpan={3} className="p-4 text-center text-gray-500">No transactions</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Mobile list */}
      <div className="md:hidden space-y-2">
        {items.map(t => (
          <details key={t.hash} className="rounded border p-2 bg-white dark:bg-[#0d121b]">
            <summary className="flex justify-between items-center cursor-pointer">
              <span className="truncate max-w-[140px]"><HashLink hash={t.hash} to={`/tx/${t.hash}`} /></span>
              <span className="text-xs text-gray-500">{timeAgo(t.createdAt)}</span>
            </summary>
            <div className="mt-2 text-xs space-y-1">
              <div><strong>Status:</strong> <StatusBadge success={t.success} /></div>
              <div><strong>Time:</strong> {new Date(t.createdAt).toLocaleString()}</div>
              <Link to={`/tx/${t.hash}`} className="inline-block text-[#0784c3] text-xs mt-1">View txn</Link>
            </div>
          </details>
        ))}
        {!items.length && !isLoading && <div className="text-center text-gray-500 text-sm">No transactions</div>}
      </div>
      <Pager
        canFirst={!!cursor}
        canPrev={!!prev}
        canNext={!!next}
        onFirst={()=> { setCursor(null); setDirection('next') }}
        onPrev={()=> { setDirection('prev'); setCursor(prev) }}
        onNext={()=> { setDirection('next'); setCursor(next) }}
      />
    </div>
  )
}
