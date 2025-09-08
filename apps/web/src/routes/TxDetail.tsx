import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { formatEther } from 'viem'

type Tx = {
  hash: string
  blockNumber: string | number
  from: string
  to?: string | null
  value: string
  success: boolean
  methodSig?: string | null
  createdAt: string
}

export default function TxDetail(){
  const { hash } = useParams()
  const { data, isLoading, isError } = useQuery<Tx | null>({
    queryKey: ['tx', hash],
    enabled: !!hash,
    queryFn: () => apiGet<Tx | null>(`/explorer/txs/${hash}`),
  })

  const valueEth = (() => {
    try { return data ? formatEther(BigInt(data.value)) : undefined } catch { return undefined }
  })()

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Transaction</h2>
      <div className="text-sm break-all">{hash}</div>
      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load.</p>}
      {data === null && <p className="text-gray-600">Not found.</p>}
      {data && (
        <div className="border rounded divide-y text-sm">
          <div className="p-2 flex items-center justify-between"><span className="text-gray-500">Status</span><span>{data.success ? 'Success' : 'Fail'}</span></div>
          <div className="p-2 flex items-center justify-between"><span className="text-gray-500">Block</span><Link className="text-blue-600" to={`/blocks/${data.blockNumber}`}>#{String(data.blockNumber)}</Link></div>
          <div className="p-2 flex items-center justify-between"><span className="text-gray-500">From</span><Link className="text-blue-600 break-all" to={`/address/${data.from}`}>{data.from}</Link></div>
          <div className="p-2 flex items-center justify-between"><span className="text-gray-500">To</span><span className="break-all">{data.to ? <Link className="text-blue-600" to={`/address/${data.to}`}>{data.to}</Link> : '—'}</span></div>
          <div className="p-2 flex items-center justify-between"><span className="text-gray-500">Value</span><span>{data.value}{valueEth ? ` (${valueEth} DOMA)` : ''}</span></div>
          <div className="p-2 flex items-center justify-between"><span className="text-gray-500">Method</span><span>{data.methodSig || '—'}</span></div>
          <div className="p-2 flex items-center justify-between"><span className="text-gray-500">Timestamp</span><span>{new Date(data.createdAt).toLocaleString()}</span></div>
        </div>
      )}
    </div>
  )
}
