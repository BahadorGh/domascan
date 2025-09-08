import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { HashLink } from '../components/HashLink'
import { formatEther } from 'viem'
import { timeAgo } from '../lib/time'

type Name = { id: string; sld: string; tld: string }
type Listing = { id: string; price: string; currency: string; status: string }
type Offer = { id: string; price: string; currency: string; status: string }
type Token = { id: string; owner: string; chainId: string; expiresAt?: string | null; listings: Listing[]; offers: Offer[] }
type Activity = { id: string; type: string; timestamp: string; tokenId: string; txHash?: string | null }
type Resp = { name: Name; tokens: Token[]; activities: Activity[]; price?: { bestAsk?: { currency: string; price: string } | null; bestBid?: { currency: string; price: string } | null } } | null

type PagedActivities = { items: Activity[]; nextCursor: string | null }

function niceType(t: string){
  return t
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function toNumber18(amount: string){
  try { return Number(formatEther(BigInt(amount))) } catch { return Number(amount) }
}

export default function DomainDetail(){
  const { id } = useParams()
  const { data, isLoading, isError } = useQuery<Resp>({
    queryKey: ['domain', id],
    enabled: !!id,
    queryFn: () => apiGet<Resp>(`/explorer/domain/${id}`),
  })
  const act = useQuery<PagedActivities>({
    queryKey: ['domain-acts', id],
    enabled: !!id,
    queryFn: () => apiGet<PagedActivities>(`/explorer/domain/${id}/activities`, { limit: 50 }),
  })
  const acts = act.data?.items || data?.activities || []
  const nextCursor = act.data?.nextCursor || null

  const rates = useQuery<{ usdPerEth: number; usdPerDoma: number }>({
    queryKey: ['rates'],
    queryFn: () => apiGet('/rates'),
  })
  const topPrice = (() => {
    if (!data?.price) return null as null | { label: string; raw: string; cur: string; eth?: number; usd?: number }
    const pick = data.price.bestAsk || data.price.bestBid
    if (!pick) return null
    const cur = pick.currency.toUpperCase()
    const raw = pick.price
    const amt = toNumber18(raw)
    let eth: number | undefined
    let usd: number | undefined
    if (rates.data) {
      if (cur === 'ETH') { eth = amt; usd = amt * rates.data.usdPerEth }
      if (cur === 'DOMA') { usd = amt * rates.data.usdPerDoma; eth = rates.data.usdPerEth ? (usd / rates.data.usdPerEth) : undefined }
    }
    return { label: data.price.bestAsk ? 'Ask' : 'Bid', raw, cur, eth, usd }
  })()
  const firstSeen = data?.activities?.length ? data.activities[data.activities.length-1].timestamp : null
  const lastActivity = data?.activities?.[0]?.timestamp || null
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Domain</h2>
      <div className="flex flex-col gap-1">
        <div className="text-sm break-all font-mono" title={id}>{id}</div>
        {topPrice && (
          <div className="text-sm text-gray-700">
            {topPrice.label}: {toNumber18(topPrice.raw)} {topPrice.cur}
            {(topPrice.eth !== undefined || topPrice.usd !== undefined) && (
              <span className="text-gray-500"> · ≈ {topPrice.eth !== undefined ? `${topPrice.eth.toLocaleString()} ETH` : ''}{topPrice.eth !== undefined && topPrice.usd !== undefined ? ' · ' : ''}{topPrice.usd !== undefined ? `$${topPrice.usd.toLocaleString()}` : ''}</span>
            )}
          </div>
        )}
      </div>
      {isLoading && (
        <div className="space-y-4">
          <div className="h-4 w-48 bg-gray-200 dark:bg-[#1b2536] animate-pulse rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-[#1b2536] animate-pulse rounded" />
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({length:3}).map((_,i)=>(<div key={i} className="h-24 bg-gray-200 dark:bg-[#1b2536] animate-pulse rounded" />))}
          </div>
        </div>
      )}
      {isError && <p className="text-red-600">Failed to load.</p>}
      {data === null && <p className="text-gray-600">Not found.</p>}
      {data && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <section>
            <h3 className="font-medium mb-2">Tokens</h3>
            <div className="border rounded divide-y text-sm">
              {data.tokens.map((t) => (
                <div key={t.id} className="p-2">
                  <div className="flex items-center justify-between">
                    <div>Token: <span className="text-gray-600">{t.id}</span></div>
                    <div>Owner: <Link className="text-blue-600 break-all" to={`/address/${t.owner}`} title={t.owner}>{t.owner}</Link></div>
                  </div>
                  <div className="text-xs text-gray-600">Chain: {t.chainId} · Expires: {t.expiresAt ? new Date(t.expiresAt).toLocaleString() : '—'}</div>
                  {!!t.listings?.length && (
                    <div className="mt-2">
                      <div className="font-medium">Listings</div>
                      <div className="text-xs grid md:grid-cols-2 gap-2 mt-1">
                        {t.listings.map((l) => {
                          const cur = l.currency.toUpperCase()
                          const amt = toNumber18(l.price)
                          const est = (() => {
                            if (!rates.data) return { eth: undefined as number | undefined, usd: undefined as number | undefined }
                            if (cur === 'ETH') return { eth: amt, usd: amt * rates.data.usdPerEth }
                            if (cur === 'DOMA') {
                              const usd = amt * rates.data.usdPerDoma
                              const eth = rates.data.usdPerEth ? usd / rates.data.usdPerEth : undefined
                              return { eth, usd }
                            }
                            return { eth: undefined, usd: undefined }
                          })()
                          return (
                            <div key={l.id} className="border rounded p-2 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span>{amt} {cur}</span>
                                {(est.eth !== undefined || est.usd !== undefined) && (
                                  <span className="text-gray-500">≈ {est.eth !== undefined ? `${est.eth.toLocaleString()} ETH` : ''}{est.eth !== undefined && est.usd !== undefined ? ' · ' : ''}{est.usd !== undefined ? `$${est.usd.toLocaleString()}` : ''}</span>
                                )}
                              </div>
                              <span className="text-gray-600">{l.status}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {!!t.offers?.length && (
                    <div className="mt-2">
                      <div className="font-medium">Offers</div>
                      <div className="text-xs grid md:grid-cols-2 gap-2 mt-1">
                        {t.offers.map((o) => {
                          const cur = o.currency.toUpperCase()
                          const amt = toNumber18(o.price)
                          const est = (() => {
                            if (!rates.data) return { eth: undefined as number | undefined, usd: undefined as number | undefined }
                            if (cur === 'ETH') return { eth: amt, usd: amt * rates.data.usdPerEth }
                            if (cur === 'DOMA') {
                              const usd = amt * rates.data.usdPerDoma
                              const eth = rates.data.usdPerEth ? usd / rates.data.usdPerEth : undefined
                              return { eth, usd }
                            }
                            return { eth: undefined, usd: undefined }
                          })()
                          return (
                            <div key={o.id} className="border rounded p-2 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span>{amt} {cur}</span>
                                {(est.eth !== undefined || est.usd !== undefined) && (
                                  <span className="text-gray-500">≈ {est.eth !== undefined ? `${est.eth.toLocaleString()} ETH` : ''}{est.eth !== undefined && est.usd !== undefined ? ' · ' : ''}{est.usd !== undefined ? `$${est.usd.toLocaleString()}` : ''}</span>
                                )}
                              </div>
                              <span className="text-gray-600">{o.status}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </section>
            <section>
            <h3 className="font-medium mb-2">Activity</h3>
            <div className="border rounded divide-y text-sm">
              {acts.map((a) => (
                <div key={a.id} className="p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{niceType(a.type)}</span>
                    {a.txHash && (
                      <HashLink hash={a.txHash} to={`/tx/${a.txHash}`} />
                    )}
                  </div>
                  <div className="text-gray-600 text-xs" title={new Date(a.timestamp).toLocaleString()}>{timeAgo(a.timestamp)}</div>
                </div>
              ))}
              {acts.length === 0 && <div className="p-2 text-gray-600">No activity</div>}
            </div>
            <div className="mt-2">
              <LoadMoreActivities id={id!} cursor={nextCursor} enabled={!!nextCursor} />
            </div>
            </section>
          </div>
          <aside className="space-y-4">
            <div className="border rounded p-3 text-xs space-y-2">
              <div className="font-semibold text-sm">Quick Stats</div>
              <div className="flex justify-between"><span className="text-gray-500">Tokens</span><span>{data.tokens.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Listings</span><span>{data.tokens.reduce((a,t)=> a + (t.listings?.length||0),0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Offers</span><span>{data.tokens.reduce((a,t)=> a + (t.offers?.length||0),0)}</span></div>
              <div className="flex justify-between" title={firstSeen ? new Date(firstSeen).toLocaleString() : ''}><span className="text-gray-500">First Seen</span><span>{firstSeen? timeAgo(firstSeen):'—'}</span></div>
              <div className="flex justify-between" title={lastActivity ? new Date(lastActivity).toLocaleString() : ''}><span className="text-gray-500">Last Activity</span><span>{lastActivity? timeAgo(lastActivity):'—'}</span></div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function LoadMoreActivities({ id, cursor, enabled }: { id: string; cursor: string | null; enabled: boolean }){
  const { data, refetch, isFetching } = useQuery<PagedActivities>({
    queryKey: ['domain-acts', id, cursor],
    enabled: false, // fetch on demand
    queryFn: () => apiGet<PagedActivities>(`/explorer/domain/${id}/activities`, { limit: 50, cursor: cursor ?? undefined }),
  })
  // This component simply offers a button; parent queryKey already holds first page.
  return (
    <div>
      <button disabled={!enabled || isFetching} onClick={() => refetch()} className="border px-3 py-1 rounded text-sm disabled:opacity-50">
        {isFetching ? 'Loading…' : enabled ? 'Load more' : 'No more'}
      </button>
      {data?.items?.length ? (
        <div className="mt-2 text-xs text-gray-500">Loaded {data.items.length} more items (navigate back to see merged list).</div>
      ) : null}
    </div>
  )
}
