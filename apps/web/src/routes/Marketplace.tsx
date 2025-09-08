import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, API_BASE } from '../lib/api'

function useInput(init: string){
  const [v, setV] = useState<string>(init)
  return { v, setV }
}

export default function Marketplace(){
  const orderbook = useInput('op')
  const chainId = useInput('97476')
  const contract = useInput('')

  const fees = useQuery({
    queryKey: ['fees', orderbook.v, chainId.v, contract.v],
    enabled: !!orderbook.v && !!chainId.v && !!contract.v,
    queryFn: () => apiGet('/marketplace/fees', { orderbook: orderbook.v, chainId: chainId.v, contract: contract.v }),
  })
  const currencies = useQuery({
    queryKey: ['currencies', chainId.v, contract.v, orderbook.v],
    enabled: !!chainId.v && !!contract.v && !!orderbook.v,
    queryFn: () => apiGet('/marketplace/currencies', { chainId: chainId.v, contract: contract.v, orderbook: orderbook.v }),
  })

  const [listingOrderId, setListingOrderId] = useState('')
  const [buyer, setBuyer] = useState('')
  const listingFulfill = useQuery({
    queryKey: ['listing', listingOrderId, buyer],
    enabled: !!listingOrderId && !!buyer,
    queryFn: () => apiGet(`/marketplace/listing/${listingOrderId}/${buyer}`),
  })

  const [offerOrderId, setOfferOrderId] = useState('')
  const [fulfiller, setFulfiller] = useState('')
  const offerFulfill = useQuery({
    queryKey: ['offer', offerOrderId, fulfiller],
    enabled: !!offerOrderId && !!fulfiller,
    queryFn: () => apiGet(`/marketplace/offer/${offerOrderId}/${fulfiller}`),
  })

  // Wallet-driven actions (assumes API key/access enabled on backend)
  const [listPayload, setListPayload] = useState('')
  const [offerPayload, setOfferPayload] = useState('')
  const [cancelList, setCancelList] = useState({ orderId: '', signature: '' })
  const [cancelOffer, setCancelOffer] = useState({ orderId: '', signature: '' })

  const postJson = async (path: string, body: any) => {
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`${path} -> ${res.status}`)
    return res.json()
  }
  const createListingMut = useMutation({ mutationFn: (body: any) => postJson('/marketplace/list', body) })
  const createOfferMut = useMutation({ mutationFn: (body: any) => postJson('/marketplace/offer', body) })
  const cancelListingMut = useMutation({ mutationFn: (body: any) => postJson('/marketplace/listing/cancel', body) })
  const cancelOfferMut = useMutation({ mutationFn: (body: any) => postJson('/marketplace/offer/cancel', body) })

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Marketplace</h2>

      <section className="space-y-2">
        <h3 className="font-medium">Fees & Supported Currencies</h3>
        <div className="grid md:grid-cols-3 gap-2 text-sm">
          <input className="border px-3 py-2 rounded" placeholder="Orderbook (op)" value={orderbook.v} onChange={(e)=>orderbook.setV(e.target.value as any)} />
          <input className="border px-3 py-2 rounded" placeholder="ChainId" value={chainId.v} onChange={(e)=>chainId.setV(e.target.value)} />
          <input className="border px-3 py-2 rounded" placeholder="Contract" value={contract.v} onChange={(e)=>contract.setV(e.target.value)} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <div className="font-medium mb-2">Fees</div>
            {fees.isLoading ? <p>Loading…</p> : fees.isError ? <p className="text-red-600">Failed to load</p> : (
              <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(fees.data, null, 2)}</pre>
            )}
          </div>
          <div className="border rounded p-3">
            <div className="font-medium mb-2">Currencies</div>
            {currencies.isLoading ? <p>Loading…</p> : currencies.isError ? <p className="text-red-600">Failed to load</p> : (
              <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(currencies.data, null, 2)}</pre>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Listing Fulfillment Preview</h3>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <input className="border px-3 py-2 rounded" placeholder="Order ID" value={listingOrderId} onChange={(e)=>setListingOrderId(e.target.value)} />
          <input className="border px-3 py-2 rounded" placeholder="Buyer Address" value={buyer} onChange={(e)=>setBuyer(e.target.value)} />
        </div>
        <div className="border rounded p-3">
          {listingFulfill.isLoading ? <p>Loading…</p> : listingFulfill.isError ? <p className="text-red-600">Failed to load</p> : (
            <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(listingFulfill.data, null, 2)}</pre>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Offer Fulfillment Preview</h3>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <input className="border px-3 py-2 rounded" placeholder="Order ID" value={offerOrderId} onChange={(e)=>setOfferOrderId(e.target.value)} />
          <input className="border px-3 py-2 rounded" placeholder="Fulfiller Address" value={fulfiller} onChange={(e)=>setFulfiller(e.target.value)} />
        </div>
        <div className="border rounded p-3">
          {offerFulfill.isLoading ? <p>Loading…</p> : offerFulfill.isError ? <p className="text-red-600">Failed to load</p> : (
            <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(offerFulfill.data, null, 2)}</pre>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Create Listing</h3>
        <p className="text-xs text-gray-600">Paste JSON payload expected by backend to create a listing via Orderbook API.</p>
        <textarea className="border rounded p-2 w-full h-32 text-xs" placeholder='{"tokenId":"...","price":"...","currency":"...","orderbook":"op"}' value={listPayload} onChange={(e)=>setListPayload(e.target.value)} />
        <div className="flex items-center gap-2">
          <button className="border px-3 py-1 rounded text-sm" onClick={()=>{
            try { const body = JSON.parse(listPayload || '{}'); createListingMut.mutate(body) } catch { alert('Invalid JSON') }
          }}>Submit</button>
          {createListingMut.isPending && <span className="text-xs">Submitting…</span>}
          {createListingMut.isError && <span className="text-xs text-red-600">Failed</span>}
          {createListingMut.data && <span className="text-xs">OrderId: {(createListingMut.data as any).orderId || 'ok'}</span>}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Create Offer</h3>
        <p className="text-xs text-gray-600">Paste JSON payload expected by backend to create an offer via Orderbook API.</p>
        <textarea className="border rounded p-2 w-full h-32 text-xs" placeholder='{"tokenId":"...","price":"...","currency":"...","orderbook":"op"}' value={offerPayload} onChange={(e)=>setOfferPayload(e.target.value)} />
        <div className="flex items-center gap-2">
          <button className="border px-3 py-1 rounded text-sm" onClick={()=>{
            try { const body = JSON.parse(offerPayload || '{}'); createOfferMut.mutate(body) } catch { alert('Invalid JSON') }
          }}>Submit</button>
          {createOfferMut.isPending && <span className="text-xs">Submitting…</span>}
          {createOfferMut.isError && <span className="text-xs text-red-600">Failed</span>}
          {createOfferMut.data && <span className="text-xs">OrderId: {(createOfferMut.data as any).orderId || 'ok'}</span>}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Cancel Listing</h3>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <input className="border px-3 py-2 rounded" placeholder="Order ID" value={cancelList.orderId} onChange={(e)=>setCancelList((s)=>({ ...s, orderId: e.target.value }))} />
          <input className="border px-3 py-2 rounded" placeholder="Signature" value={cancelList.signature} onChange={(e)=>setCancelList((s)=>({ ...s, signature: e.target.value }))} />
        </div>
        <div>
          <button className="border px-3 py-1 rounded text-sm" onClick={()=> cancelListingMut.mutate(cancelList)}>Cancel Listing</button>
          {cancelListingMut.isPending && <span className="ml-2 text-xs">Submitting…</span>}
          {cancelListingMut.isError && <span className="ml-2 text-xs text-red-600">Failed</span>}
          {cancelListingMut.data && <span className="ml-2 text-xs">Cancelled</span>}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Cancel Offer</h3>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <input className="border px-3 py-2 rounded" placeholder="Order ID" value={cancelOffer.orderId} onChange={(e)=>setCancelOffer((s)=>({ ...s, orderId: e.target.value }))} />
          <input className="border px-3 py-2 rounded" placeholder="Signature" value={cancelOffer.signature} onChange={(e)=>setCancelOffer((s)=>({ ...s, signature: e.target.value }))} />
        </div>
        <div>
          <button className="border px-3 py-1 rounded text-sm" onClick={()=> cancelOfferMut.mutate(cancelOffer)}>Cancel Offer</button>
          {cancelOfferMut.isPending && <span className="ml-2 text-xs">Submitting…</span>}
          {cancelOfferMut.isError && <span className="ml-2 text-xs text-red-600">Failed</span>}
          {cancelOfferMut.data && <span className="ml-2 text-xs">Cancelled</span>}
        </div>
      </section>
    </div>
  )
}
