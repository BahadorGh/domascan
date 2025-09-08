import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiGet } from '../lib/api'

type VolumeResp = { since: string; txs: number; blocks: number; notional24h?: string; notionalByCurrency?: Record<string, string> }
type TrendingTldsResp = { since: string; items: Array<{ tld: string; count: number }> }
type KeywordsResp = { since: string; items: Array<{ keyword: string; count: number }> }
type PopularResp = { since: string; items: Array<{ id: string; nameId: string; name?: { id: string } | null; price?: { bestAsk?: { currency: string; price: string } | null; bestBid?: { currency: string; price: string } | null } }> }
type Price = { currency: string; price: string }
type FloorResp = { items: Array<{ tld: string; floorAsk?: Price | null; floorBid?: Price | null; domainsWithAsks: number; domainsWithBids: number }> }
type LiquidityResp = { items: Array<{ tld: string; listings: number; offers: number; avgSpreadEth: number; pairs: number }> }
type SalesByTldResp = { since: string; items: Array<{ tld: string; count: number; notionalByCurrency: Record<string, string> }> }
type LeaderboardResp = { since: string; buyers: Array<{ address: string; count: number; notionalByCurrency: Record<string, string> }>; sellers: Array<{ address: string; count: number; notionalByCurrency: Record<string, string> }> }
function fmtPrice(p?: { currency: string; price: string } | null){
  if (!p) return '—'
  return `${Number(p.price)/1e18} ${p.currency.toUpperCase()}`
}

function sumUsd(by: Record<string, string> | undefined, rates?: { usdPerEth: number; usdPerDoma: number }){
  if (!by || !rates) return '—'
  let usd = 0
  for (const [cur, amt] of Object.entries(by)) {
    const v = Number(amt) / 1e18
    const c = cur.toUpperCase()
    if (c === 'ETH') usd += v * (rates.usdPerEth || 0)
    if (c === 'DOMA') usd += v * (rates.usdPerDoma || 0)
  }
  return usd ? `$${usd.toLocaleString()}` : '—'
}

export default function Analytics(){
  const volume = useQuery<VolumeResp>({ queryKey: ['volume'], queryFn: () => apiGet('/analytics/volume', { hours: 24 }) })
  const rates = useQuery<{ usdPerEth: number; usdPerDoma: number; updatedAt?: string }>({ queryKey: ['rates'], queryFn: () => apiGet('/rates') })
  const tlds = useQuery<TrendingTldsResp>({ queryKey: ['trending-tlds'], queryFn: () => apiGet('/analytics/trending-tlds', { hours: 24 }) })
  const keywords = useQuery<KeywordsResp>({ queryKey: ['keywords'], queryFn: () => apiGet('/analytics/keywords', { hours: 24 }) })
  const popular = useQuery<PopularResp>({ queryKey: ['popular-domains'], queryFn: () => apiGet('/analytics/popular-domains', { hours: 24 }) })
  const floor = useQuery<FloorResp>({ queryKey: ['floor-by-tld'], queryFn: () => apiGet('/analytics/floor-by-tld') })
  const liquidity = useQuery<LiquidityResp>({ queryKey: ['liquidity-by-tld'], queryFn: () => apiGet('/analytics/liquidity-by-tld') })
  const sales = useQuery<SalesByTldResp>({ queryKey: ['sales-by-tld'], queryFn: () => apiGet('/analytics/sales-by-tld', { hours: 24 }) })
  const leaderboard = useQuery<LeaderboardResp>({ queryKey: ['leaderboard'], queryFn: () => apiGet('/analytics/leaderboard', { hours: 24 }) })

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Analytics</h2>
      <div className="text-xs text-gray-600">
        <span>
          Rates last updated: {rates.data?.updatedAt ? new Date(rates.data.updatedAt).toLocaleString() : '—'}
        </span>
        {volume.data?.since && (
          <span> · Window since: {new Date(volume.data.since).toLocaleString()}</span>
        )}
      </div>

      <section>
        <h3 className="font-medium mb-2">Volume (24h)</h3>
        {volume.isLoading ? <p>Loading…</p> : volume.isError ? <p className="text-red-600">Failed to load.</p> : (
          <div className="text-sm">
            Txs: {volume.data?.txs} · Blocks: {volume.data?.blocks}
            {(() => {
              const by = volume.data?.notionalByCurrency || {}
              const usdPerEth = rates.data?.usdPerEth || 0
              const usdPerDoma = rates.data?.usdPerDoma || 0
              let usd = 0
              for (const [cur, amt] of Object.entries(by)) {
                const v = Number(amt) / 1e18
                if (cur.toUpperCase() === 'ETH') usd += v * usdPerEth
                if (cur.toUpperCase() === 'DOMA') usd += v * usdPerDoma
              }
              return ` · Volume(24h): ${usd ? `$${usd.toLocaleString()}` : '—'}`
            })()}
            · Since: {volume.data?.since && new Date(volume.data.since).toLocaleString()}
          </div>
        )}
      </section>

      <section>
  <h3 className="font-medium mb-2">Trending TLDs</h3>
  <div className="text-xs text-gray-600 mb-1">Since: {tlds.data?.since ? new Date(tlds.data.since).toLocaleString() : '—'}</div>
        {tlds.isLoading ? <p>Loading…</p> : tlds.isError ? <p className="text-red-600">Failed to load.</p> : (
          <div className="border rounded divide-y text-sm">
            {(tlds.data?.items || []).map((x) => (
              <div key={x.tld} className="p-2 flex items-center justify-between">
                <span>{x.tld || '(none)'}</span><span className="text-gray-600">{x.count}</span>
              </div>
            ))}
            {tlds.data?.items?.length === 0 && <div className="p-2 text-gray-600">No data</div>}
          </div>
        )}
      </section>

      <section>
  <h3 className="font-medium mb-2">Keyword Trends</h3>
  <div className="text-xs text-gray-600 mb-1">Since: {keywords.data?.since ? new Date(keywords.data.since).toLocaleString() : '—'}</div>
        {keywords.isLoading ? <p>Loading…</p> : keywords.isError ? <p className="text-red-600">Failed to load.</p> : (
          <div className="border rounded divide-y text-sm">
            {(keywords.data?.items || []).map((x) => (
              <div key={x.keyword} className="p-2 flex items-center justify-between">
                <span>{x.keyword}</span><span className="text-gray-600">{x.count}</span>
              </div>
            ))}
            {keywords.data?.items?.length === 0 && <div className="p-2 text-gray-600">No data</div>}
          </div>
        )}
      </section>

      <section>
  <h3 className="font-medium mb-2">Popular Domains</h3>
  <div className="text-xs text-gray-600 mb-1">Since: {popular.data?.since ? new Date(popular.data.since).toLocaleString() : '—'}</div>
        {popular.isLoading ? <p>Loading…</p> : popular.isError ? <p className="text-red-600">Failed to load.</p> : (
          <div className="border rounded divide-y text-sm">
      {(popular.data?.items || []).map((tk) => (
              <div key={tk.id} className="p-2 flex items-center justify-between">
                <Link to={`/domain/${encodeURIComponent(tk.name?.id || tk.nameId)}`} className="text-blue-600 break-all hover:underline">{tk.name?.id || tk.nameId}</Link>
        <span className="text-gray-600 text-xs">ask: {fmtPrice(tk.price?.bestAsk)} · bid: {fmtPrice(tk.price?.bestBid)}</span>
              </div>
            ))}
            {popular.data?.items?.length === 0 && <div className="p-2 text-gray-600">No data</div>}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-medium mb-2">Floor by TLD</h3>
        {floor.isLoading ? <p>Loading…</p> : floor.isError ? <p className="text-red-600">Failed to load.</p> : (
          <div className="border rounded divide-y text-sm">
            {(floor.data?.items || []).map((x) => (
              <div key={x.tld} className="p-2 grid grid-cols-5 gap-2 items-center">
                <span className="col-span-2">{x.tld || '(none)'}</span>
                <span className="text-gray-600">Ask: {fmtPrice(x.floorAsk || undefined)}</span>
                <span className="text-gray-600">Bid: {fmtPrice(x.floorBid || undefined)}</span>
                <span className="text-gray-600 text-right">#{x.domainsWithAsks}/{x.domainsWithBids}</span>
              </div>
            ))}
            {floor.data?.items?.length === 0 && <div className="p-2 text-gray-600">No data</div>}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-medium mb-2">Liquidity by TLD</h3>
        {liquidity.isLoading ? <p>Loading…</p> : liquidity.isError ? <p className="text-red-600">Failed to load.</p> : (
          <div className="border rounded divide-y text-sm">
            {(liquidity.data?.items || []).map((x) => (
              <div key={x.tld} className="p-2 grid grid-cols-5 gap-2 items-center">
                <span className="col-span-2">{x.tld || '(none)'}</span>
                <span className="text-gray-600">Listings: {x.listings}</span>
                <span className="text-gray-600">Offers: {x.offers}</span>
                <span className="text-gray-600 text-right">Avg spread: {x.avgSpreadEth?.toFixed ? x.avgSpreadEth.toFixed(4) : x.avgSpreadEth} ETH</span>
              </div>
            ))}
            {liquidity.data?.items?.length === 0 && <div className="p-2 text-gray-600">No data</div>}
          </div>
        )}
      </section>

      <section>
  <h3 className="font-medium mb-2">Sales by TLD (24h)</h3>
  <div className="text-xs text-gray-600 mb-1">Since: {sales.data?.since ? new Date(sales.data.since).toLocaleString() : '—'}</div>
        {sales.isLoading ? <p>Loading…</p> : sales.isError ? <p className="text-red-600">Failed to load.</p> : (
          <div className="border rounded divide-y text-sm">
            {(sales.data?.items || []).map((x) => (
              <div key={x.tld} className="p-2 flex items-center justify-between">
                <span>{x.tld || '(none)'} · <span className="text-gray-600">{x.count} sales</span></span>
                <span className="text-gray-600">{sumUsd(x.notionalByCurrency, rates.data)}</span>
              </div>
            ))}
            {sales.data?.items?.length === 0 && <div className="p-2 text-gray-600">No data</div>}
          </div>
        )}
      </section>

      <section>
  <h3 className="font-medium mb-2">Leaderboard (24h)</h3>
  <div className="text-xs text-gray-600 mb-1">Since: {leaderboard.data?.since ? new Date(leaderboard.data.since).toLocaleString() : '—'}</div>
        {leaderboard.isLoading ? <p>Loading…</p> : leaderboard.isError ? <p className="text-red-600">Failed to load.</p> : (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-1">Top Buyers</h4>
              <div className="border rounded divide-y text-sm">
                {(leaderboard.data?.buyers || []).map((x) => (
                  <div key={`buyer-${x.address}`} className="p-2 flex items-center justify-between">
                    <span className="truncate" title={x.address}>{x.address}</span>
                    <span className="text-gray-600">{x.count} · {sumUsd(x.notionalByCurrency, rates.data)}</span>
                  </div>
                ))}
                {leaderboard.data?.buyers?.length === 0 && <div className="p-2 text-gray-600">No data</div>}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-1">Top Sellers</h4>
              <div className="border rounded divide-y text-sm">
                {(leaderboard.data?.sellers || []).map((x) => (
                  <div key={`seller-${x.address}`} className="p-2 flex items-center justify-between">
                    <span className="truncate" title={x.address}>{x.address}</span>
                    <span className="text-gray-600">{x.count} · {sumUsd(x.notionalByCurrency, rates.data)}</span>
                  </div>
                ))}
                {leaderboard.data?.sellers?.length === 0 && <div className="p-2 text-gray-600">No data</div>}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
