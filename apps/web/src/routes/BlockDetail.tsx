import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { timeAgo } from '../lib/time'

type Tx = { hash: string; success: boolean }
type BlockDetailT = { hash: string; parentHash: string; timestamp: string; txs: Tx[] }

export default function BlockDetail(){
  const { number } = useParams()
  const { data, isLoading, isError } = useQuery<BlockDetailT>({
    queryKey: ['block', number],
    enabled: !!number,
    queryFn: () => apiGet<BlockDetailT>(`/explorer/blocks/${number}`),
  })
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Block #{number}</h2>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load.</p>}
      {data && (
        <div className="space-y-2">
          <div className="text-sm"><span className="text-gray-500">Hash:</span> <span className="break-all">{data.hash}</span></div>
          <div className="text-sm"><span className="text-gray-500">Parent:</span> <span className="break-all">{data.parentHash}</span></div>
          <div className="text-sm"><span className="text-gray-500">Time:</span> {timeAgo(data.timestamp)} ({new Date(data.timestamp).toLocaleString()})</div>
          <div className="text-sm"><span className="text-gray-500">Txs:</span> {data.txs?.length || 0}</div>
          {!!data.txs?.length && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Transactions</h3>
              <div className="border rounded divide-y">
                {data.txs.map((t: any) => (
                  <div key={t.hash} className="p-2 text-sm flex items-center justify-between">
                    <Link className="text-blue-600" to={`/tx/${t.hash}`}>{t.hash}</Link>
                    <div className={`text-xs px-2 py-1 rounded ${t.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.success ? 'Success' : 'Fail'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <Link to="/blocks" className="text-blue-600 text-sm">Back</Link>
    </div>
  )
}
