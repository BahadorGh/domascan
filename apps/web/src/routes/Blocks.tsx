import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { timeAgo } from '../lib/time'
import { HashLink } from '../components/HashLink'
import { Pager } from '../components/Pager'
import { useQuerySync } from '../lib/useQuerySync'
import { Tooltip } from '../components/Tooltip'
import { useSearchParams, Link } from 'react-router-dom'

type Block = { number: string | number; hash: string; timestamp: string; txCount: number }
type BlocksResp = { items: Block[]; nextCursor: string | null; prevCursor: string | null }
// moved trunc & copy to HashLink component

export default function Blocks(){
  const [sp] = useSearchParams()
  const [cursor, setCursor] = useState<string | null>(null)
  const [limit, setLimit] = useState(()=> Number(sp.get('limit') || 20))
  const [direction, setDirection] = useState<'next'|'prev'>('next')
  const [sort, setSort] = useState<'number_desc'|'number_asc'>(()=> (sp.get('sort') as any) || 'number_desc')
  useEffect(()=> { const l = sp.get('limit'); if(l) setLimit(Number(l)); const s = sp.get('sort'); if(s) setSort(s as any) }, [sp])
  useQuerySync({ limit, sort })
  const { data, isLoading, isError, refetch } = useQuery<BlocksResp>({
    queryKey: ['blocks', cursor, limit, direction, sort],
    queryFn: () => apiGet<BlocksResp>('/explorer/blocks', { limit, cursor: cursor || undefined, dir: direction, sort }),
    placeholderData: (prev)=> prev,
  })
  const items = data?.items || []
  const next = data?.nextCursor || null
  const prev = data?.prevCursor || null
  return (
    <div className="space-y-3">
      <div className="table-toolbar">
        <h2 className="text-lg font-semibold">Blocks</h2>
        <div className="flex items-center gap-2">
          <select value={limit} onChange={e=>{ setCursor(null); setLimit(Number(e.target.value)) }} className="table-select">
            {[10,20,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={sort} onChange={e=> { setCursor(null); setSort(e.target.value as any); setDirection('next') }} className="table-select">
            <option value="number_desc">Newest</option>
            <option value="number_asc">Oldest</option>
          </select>
          <button className="btn" onClick={()=> { setCursor(null); refetch() }}>Refresh</button>
        </div>
      </div>
      {isLoading && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 8 }).map((_,i)=>(
                <tr key={i} className="animate-pulse">
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-20" /></td>
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-10" /></td>
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-24" /></td>
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-48" /></td>
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
              <th className="text-left p-2">Block</th>
              <th className="text-left p-2">Txs</th>
              <th className="text-left p-2">Age</th>
              <th className="text-left p-2">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(b => (
              <tr key={String(b.number)} className="hover:bg-gray-50 dark:hover:bg-[#141c2c]">
                <td className="p-2 font-medium" title={`Block #${b.number} at ${new Date(b.timestamp).toLocaleString()}`}><Link to={`/blocks/${b.number}`} className="text-[#0784c3]">#{String(b.number)}</Link></td>
                <td className="p-2">{b.txCount}</td>
                <td className="p-2 text-xs text-gray-500"><Tooltip content={new Date(b.timestamp).toLocaleString()}>{timeAgo(b.timestamp)}</Tooltip></td>
                <td className="p-2"><HashLink hash={b.hash} to={`/tx/${b.hash}`} /></td>
              </tr>
            ))}
            {!items.length && !isLoading && (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Mobile list */}
      <div className="md:hidden space-y-2">
        {items.map(b => (
          <details key={String(b.number)} className="rounded border p-2 bg-white dark:bg-[#0d121b]">
            <summary className="flex justify-between items-center cursor-pointer">
              <span className="font-medium text-[#0784c3]">#{String(b.number)}</span>
              <span className="text-xs text-gray-500">{timeAgo(b.timestamp)}</span>
            </summary>
            <div className="mt-2 text-xs space-y-1">
              <div><strong>Txs:</strong> {b.txCount}</div>
              <div><strong>Hash:</strong> <HashLink hash={b.hash} to={`/tx/${b.hash}`} /></div>
              <div><strong>Time:</strong> {new Date(b.timestamp).toLocaleString()}</div>
              <Link to={`/blocks/${b.number}`} className="inline-block text-[#0784c3] text-xs mt-1">View block</Link>
            </div>
          </details>
        ))}
        {!items.length && !isLoading && <div className="text-center text-gray-500 text-sm">No data</div>}
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
