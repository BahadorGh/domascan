import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { HashLink } from '../components/HashLink'
import { timeAgo } from '../lib/time'

type AddressResp = {
  txs: Array<{ hash: string; createdAt: string; from: string; to?: string | null; value: string; success: boolean }>
  tokens: Array<{ id: string; nameId: string; name: { id: string } }>
}

export default function Address(){
  const { addr } = useParams()
  const { data, isLoading, isError } = useQuery<AddressResp>({
    queryKey: ['address', addr],
    enabled: !!addr,
    queryFn: () => apiGet<AddressResp>(`/explorer/address/${addr}`),
  })
  const firstSeen = data?.txs?.length ? data.txs[data.txs.length-1].createdAt : null
  const lastActivity = data?.txs?.[0]?.createdAt || null
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Address</h2>
          <div className="text-sm break-all font-mono" title={addr}>{addr}</div>
        </div>
        {data && (
          <div className="grid grid-cols-3 gap-3 text-xs w-full md:w-auto">
            <div className="border rounded p-2 flex flex-col" title={firstSeen ? new Date(firstSeen).toLocaleString() : ''}>
              <span className="text-gray-500">First Seen</span>
              <span>{firstSeen ? timeAgo(firstSeen) : '—'}</span>
            </div>
            <div className="border rounded p-2 flex flex-col" title={lastActivity ? new Date(lastActivity).toLocaleString() : ''}>
              <span className="text-gray-500">Last Activity</span>
              <span>{lastActivity ? timeAgo(lastActivity) : '—'}</span>
            </div>
            <div className="border rounded p-2 flex flex-col">
              <span className="text-gray-500">Tx Count</span>
              <span>{data.txs.length}</span>
            </div>
          </div>
        )}
      </div>
      {isLoading && (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({length:2}).map((_,i)=>(
            <div key={i} className="space-y-2">
              <div className="h-4 w-40 bg-gray-200 dark:bg-[#1b2536] animate-pulse rounded" />
              <div className="border rounded divide-y">
                {Array.from({length:6}).map((_,j)=>(<div key={j} className="p-2 flex justify-between animate-pulse"><div className="h-4 w-40 bg-gray-200 dark:bg-[#1b2536] rounded"/><div className="h-4 w-24 bg-gray-200 dark:bg-[#1b2536] rounded"/></div>))}
              </div>
            </div>
          ))}
        </div>
      )}
      {isError && <p className="text-red-600">Failed to load.</p>}
      {data && !isLoading && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div>
              <h3 className="font-medium mb-2">Recent Transactions</h3>
              <div className="border rounded divide-y text-sm">
                {data.txs.map((t) => (
                  <div key={t.hash} className="p-2 flex items-center justify-between gap-4">
                    <HashLink hash={t.hash} to={`/tx/${t.hash}`} />
                    <span className="text-gray-600 text-xs" title={new Date(t.createdAt).toLocaleString()}>{timeAgo(t.createdAt)}</span>
                  </div>
                ))}
                {data.txs.length === 0 && <div className="p-2 text-sm text-gray-600">No transactions</div>}
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Owned Domains</h3>
              <div className="border rounded divide-y text-sm">
                {data.tokens.map((tk) => (
                  <div key={tk.id} className="p-2 flex items-center justify-between gap-4">
                    <Link to={`/domain/${tk.name?.id || tk.nameId}`} className="break-all text-[#0784c3]">{tk.name?.id || tk.nameId}</Link>
                    <span className="text-gray-600 text-xs" title={tk.id}>{tk.id}</span>
                  </div>
                ))}
                {data.tokens.length === 0 && <div className="p-2 text-sm text-gray-600">No tokens</div>}
              </div>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="border rounded p-3 text-xs space-y-2">
              <div className="font-semibold text-sm">Quick Stats</div>
              <div className="flex justify-between"><span className="text-gray-500">Tx Count</span><span>{data.txs.length}</span></div>
              <div className="flex justify-between" title={firstSeen ? new Date(firstSeen).toLocaleString() : ''}><span className="text-gray-500">First Seen</span><span>{firstSeen ? timeAgo(firstSeen) : '—'}</span></div>
              <div className="flex justify-between" title={lastActivity ? new Date(lastActivity).toLocaleString() : ''}><span className="text-gray-500">Last Activity</span><span>{lastActivity ? timeAgo(lastActivity) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Domains</span><span>{data.tokens.length}</span></div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
