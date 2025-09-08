import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { Link } from 'react-router-dom'
import { timeAgo } from '../lib/time'

type Block = { number: string | number; timestamp: string; txCount: number }
type BlocksResp = { items: Block[] }
type Tx = { hash: string; createdAt: string; success: boolean }
type TxsResp = { items: Tx[] }

export default function Home(){
  const blocks = useQuery<BlocksResp>({ queryKey: ['home-blocks'], queryFn: () => apiGet('/explorer/blocks', { limit: 5 }) })
  const txs = useQuery<TxsResp>({ queryKey: ['home-txs'], queryFn: () => apiGet('/explorer/txs', { limit: 5 }) })
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">DomaScan Testnet Explorer</h1>
        <p className="text-sm text-gray-600">Track blocks, transactions, domains and marketplace activity.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded shadow-sm">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-medium text-sm">Latest Blocks</h2>
            <Link to="/blocks" className="text-xs text-[#0784c3]">View all</Link>
          </div>
          <div className="divide-y text-sm">
            {blocks.isLoading && <div className="p-3 text-gray-500">Loading…</div>}
            {blocks.isError && <div className="p-3 text-red-600">Failed to load</div>}
            {(blocks.data?.items || []).map(b => (
              <div key={String(b.number)} className="p-3 flex items-center justify-between">
                <div>
                  <Link to={`/blocks/${b.number}`} className="text-[#0784c3] font-medium">#{b.number}</Link>
                  <div className="text-xs text-gray-500">{timeAgo(b.timestamp)}</div>
                </div>
                <div className="text-xs text-gray-600">{b.txCount} txs</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded shadow-sm">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-medium text-sm">Latest Transactions</h2>
            <Link to="/txs" className="text-xs text-[#0784c3]">View all</Link>
          </div>
          <div className="divide-y text-sm">
            {txs.isLoading && <div className="p-3 text-gray-500">Loading…</div>}
            {txs.isError && <div className="p-3 text-red-600">Failed to load</div>}
            {(txs.data?.items || []).map(t => (
              <div key={t.hash} className="p-3 flex items-center justify-between">
                <div className="flex-1">
                  <Link to={`/tx/${t.hash}`} className="text-[#0784c3] break-all">{t.hash.slice(0,18)}…</Link>
                  <div className="text-xs text-gray-500">{timeAgo(t.createdAt)}</div>
                </div>
                <div className={`text-xs px-2 py-1 rounded ${t.success? 'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{t.success? 'Success':'Fail'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
