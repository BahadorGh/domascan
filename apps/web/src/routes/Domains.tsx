import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Pager } from '../components/Pager'
import { useDebounce } from '../lib/useDebounce'
import { useQuerySync } from '../lib/useQuerySync'
import { Tooltip } from '../components/Tooltip'

type DomainItem = { nameId: string; name?: { id: string } | null; bestAsk?: { currency: string; price: string } | null; bestBid?: { currency: string; price: string } | null }
function fmt(p?: { currency: string; price: string } | null){
  if (!p) return '—'
  const cur = p.currency.toUpperCase()
  // assume 18 decimals
  const val = Number(p.price)/1e18
  return `${val} ${cur}`
}
type DomainsResp = { items: Array<DomainItem>; nextCursor: string | null; prevCursor: string | null }

function useQueryParam(key: string) {
  const { search } = useLocation()
  return new URLSearchParams(search).get(key) || ''
}

export default function Domains(){
  const initialQ = useQueryParam('q')
  const [sp] = useSearchParams()
  const [q, setQ] = useState(initialQ)
  const [cursor, setCursor] = useState<string | null>(null)
  const [limit, setLimit] = useState(()=> Number(sp.get('limit') || 20))
  const [sort, setSort] = useState<'name_asc'|'name_desc'>(()=> (sp.get('sort') as any) || 'name_asc')
  const [direction, setDirection] = useState<'next'|'prev'>('next')
  // human-readable price inputs (ETH/DOMA) -> convert to wei for query
  const [minPriceHR, setMinPriceHR] = useState('')
  const [maxPriceHR, setMaxPriceHR] = useState('')
  const [priceCur, setPriceCur] = useState('ETH')
  useEffect(()=>{ setQ(initialQ); setCursor(null) }, [initialQ])
  const debouncedQ = useDebounce(q, 400)
  const debouncedMin = useDebounce(minPriceHR, 400)
  const debouncedMax = useDebounce(maxPriceHR, 400)
  // convert human values to wei strings (assume 18 decimals) only when numeric
  const toWei = (v: string) => {
    if(!v.trim()) return ''
    const num = Number(v)
    if(isNaN(num)) return ''
    return BigInt(Math.floor(num * 1e6)) * (10n ** 12n) + '' // multiply preserving some precision
  }
  const minPrice = toWei(debouncedMin)
  const maxPrice = toWei(debouncedMax)
  useQuerySync({ q: debouncedQ, limit, sort, minPrice: debouncedMin || undefined, maxPrice: debouncedMax || undefined, priceCur })
  const { data, isLoading, isError, refetch } = useQuery<DomainsResp>({
    queryKey: ['domains', debouncedQ, cursor, limit, sort, direction, minPrice, maxPrice, priceCur],
    queryFn: () => apiGet<DomainsResp>('/explorer/domains', { limit, q: debouncedQ || undefined, cursor: cursor || undefined, sort, dir: direction, minPrice: minPrice || undefined, maxPrice: maxPrice || undefined, priceCur: priceCur || undefined }),
    placeholderData: (p)=> p,
  })
  const items = data?.items || []
  const next = data?.nextCursor || null
  const prev = data?.prevCursor || null

  return (
    <div className="space-y-4">
      <div className="table-toolbar">
        <h2 className="text-lg font-semibold">Domains</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input value={q} onChange={(e)=>{ setCursor(null); setQ(e.target.value) }} placeholder="Search domain" className="table-filter-input" />
          <select value={limit} onChange={e=>{ setCursor(null); setLimit(Number(e.target.value)) }} className="table-select" title="Rows per page">
            {[10,20,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={sort} onChange={e=> { setCursor(null); setSort(e.target.value as any); setDirection('next') }} className="table-select">
            <option value="name_asc">A → Z</option>
            <option value="name_desc">Z → A</option>
          </select>
          <select value={priceCur} onChange={e=> { setCursor(null); setPriceCur(e.target.value) }} className="table-select" title="Price currency">
            <option value="ETH">ETH</option>
            <option value="DOMA">DOMA</option>
          </select>
          <Tooltip content="Filter minimum list/offer price in selected currency (human units)">
            <input value={minPriceHR} onChange={e=> { setCursor(null); setMinPriceHR(e.target.value) }} placeholder={`Min (${priceCur})`} className="table-filter-input" />
          </Tooltip>
          <Tooltip content="Filter maximum list/offer price in selected currency (human units)">
            <input value={maxPriceHR} onChange={e=> { setCursor(null); setMaxPriceHR(e.target.value) }} placeholder={`Max (${priceCur})`} className="table-filter-input" />
          </Tooltip>
          <button onClick={()=>{ setCursor(null); refetch() }} className="btn">Apply</button>
        </div>
      </div>
      {isLoading && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 8 }).map((_,i)=>(
                <tr key={i} className="animate-pulse">
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-40" /></td>
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-32" /></td>
                  <td className="p-2"><div className="h-4 bg-gray-200 dark:bg-[#1b2536] rounded w-56" /></td>
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
              <th className="text-left p-2">Domain</th>
              <th className="text-left p-2">Prices</th>
              <th className="text-left p-2">Full Name</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(t => (
              <tr key={t.nameId} className="hover:bg-gray-50 dark:hover:bg-[#141c2c]">
                <td className="p-2"><Link to={`/domain/${encodeURIComponent(t.name?.id || t.nameId)}`} className="text-[#0784c3] break-all">{t.name?.id || t.nameId}</Link></td>
                <td className="p-2 text-xs text-gray-600">ask: {fmt(t.bestAsk)} · bid: {fmt(t.bestBid)}</td>
                <td className="p-2 text-xs font-mono">
                  {t.nameId}
                  <button onClick={()=> navigator.clipboard.writeText(t.nameId)} className="hash-btn ml-2">Copy</button>
                </td>
              </tr>
            ))}
            {!items.length && !isLoading && <tr><td colSpan={3} className="p-4 text-center text-gray-500">No results</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Mobile list */}
      <div className="md:hidden space-y-2">
        {items.map(t => (
          <details key={t.nameId} className="rounded border p-2 bg-white dark:bg-[#0d121b]">
            <summary className="flex justify-between items-center cursor-pointer">
              <span className="text-[#0784c3] truncate max-w-[150px]">{t.name?.id || t.nameId}</span>
            </summary>
            <div className="mt-2 text-xs space-y-1">
              <div><strong>Ask:</strong> {fmt(t.bestAsk)}</div>
              <div><strong>Bid:</strong> {fmt(t.bestBid)}</div>
              <div className="font-mono break-all">{t.nameId}</div>
              <button onClick={()=> navigator.clipboard.writeText(t.nameId)} className="hash-btn mt-1">Copy</button>
              <Link to={`/domain/${encodeURIComponent(t.name?.id || t.nameId)}`} className="block text-[#0784c3] text-xs mt-1">View domain</Link>
            </div>
          </details>
        ))}
        {!items.length && !isLoading && <div className="text-center text-gray-500 text-sm">No results</div>}
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
