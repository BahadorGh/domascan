import React from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { apiGet } from '../lib/api'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { StarfieldBackground } from './StarfieldBackground'

function usePersisted<T>(key: string, def: T): [T, (v: T)=>void] {
  const [val, setVal] = React.useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def }
  })
  const set = (v: T) => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }
  return [val, set]
}

export function EtherscanLayout(){
  const [q, setQ] = React.useState('')
  const [dark, setDark] = usePersisted<boolean>('ui.dark', false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(()=>{
    const el = rootRef.current; if(!el) return; if(dark) el.classList.add('dark'); else el.classList.remove('dark');
  }, [dark])
  const stats = useStats()
  const navigate = useNavigate()
  async function onSubmit(e: React.FormEvent){
    e.preventDefault()
    const v = q.trim(); if(!v) return
    if (v.startsWith('0x') && v.length===66) return navigate(`/tx/${v}`)
    if (/^\d+$/.test(v)) return navigate(`/blocks/${v}`)
    try {
      const res = await apiGet<{ results: Array<{ type: string; hash?: string; id?: string; number?: string }> }>(`/explorer/search`, { q: v })
      const r = res.results?.[0]
      if (r?.type==='tx' && r.hash) return navigate(`/tx/${r.hash}`)
      if (r?.type==='block' && r.number) return navigate(`/blocks/${r.number}`)
      if (r?.type==='domain' && r.id) return navigate(`/domain/${encodeURIComponent(r.id)}`)
    } catch {}
    navigate(`/domains?q=${encodeURIComponent(v)}`)
  }
  return (
    <div ref={rootRef} className="min-h-screen flex flex-col relative dark:text-gray-200 transition-colors">
      <StarfieldBackground className={dark? 'opacity-100':'opacity-0'} />
      <TopBar dark={dark} toggleDark={()=> setDark(!dark)} stats={stats} />
      <HeaderSearch q={q} setQ={setQ} onSubmit={onSubmit} />
      <SubNav />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto p-4 md:p-6 relative">
          <Outlet />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function useStats(){
  const [data, setData] = React.useState<{ latestBlock: string|null; remoteLatest?: string|null; lag?: string|null; txCount: number; domainCount: number; updatedAt: string }|null>(null)
  React.useEffect(()=>{ let t: any; const load=()=>{ apiGet('/explorer/stats').then(d=> setData(d as any)).catch(()=>{}) ; t=setTimeout(load, 15000)}; load(); return ()=> clearTimeout(t) },[])
  return data
}

function TopBar({ dark, toggleDark, stats }: { dark: boolean; toggleDark: ()=>void; stats: ReturnType<typeof useStats> }){
  return (
    <div className="w-full bg-[#152039] dark:bg-[#0a1020] text-gray-200 text-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-9 px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-semibold text-sm text-white">DomaScan</Link>
          <span className="hidden sm:inline text-gray-400">Testnet</span>
          {stats && (
            <div className="hidden md:flex items-center gap-3 text-[11px] text-gray-300">
              <span>Blk: {stats.latestBlock ?? '—'}</span>
              {stats.remoteLatest && (
                <span title="Remote latest block">Net: {stats.remoteLatest}</span>
              )}
              {stats.lag && (
                <LagBadge lag={parseInt(stats.lag,10)} />
              )}
              <span>Txs: {stats.txCount?.toLocaleString?.() ?? '—'}</span>
              <span>Domains: {stats.domainCount?.toLocaleString?.() ?? '—'}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleDark} className="text-[11px] px-2 py-1 rounded bg-[#243256] hover:bg-[#2d3e66] text-gray-200">{dark? 'Light':'Dark'}</button>
          <NavLink to="/analytics" className={({isActive}) => isActive? 'text-white' : 'text-gray-300 hover:text-white'}>Analytics</NavLink>
          <ConnectButton chainStatus="none" showBalance={false} accountStatus="address" />
        </div>
      </div>
    </div>
  )
}

function LagBadge({ lag }: { lag: number }){
  let color = 'bg-green-600';
  let label = `${lag}`;
  if (lag > 500) { color = 'bg-yellow-600'; }
  if (lag > 2000) { color = 'bg-red-600'; }
  return <span title={`Block lag (remote - local)`} className={`px-2 py-0.5 rounded text-white ${color}`}>Lag: {label}</span>
}

function HeaderSearch({ q, setQ, onSubmit }: { q: string; setQ: (v:string)=>void; onSubmit:(e:React.FormEvent)=>void }){
  return (
    <div className="border-b bg-white dark:bg-[#141c2c] dark:border-[#1f2a3d]">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-2 text-[#152039] dark:text-gray-100 font-semibold text-lg">Explorer</div>
        <form onSubmit={onSubmit} className="flex-1 flex items-stretch">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by Address / Txn Hash / Block / Domain" className="flex-1 border rounded-l px-3 py-2 text-sm focus:outline-none dark:bg-[#0e1525] dark:border-[#1f2a3d] dark:text-gray-200" />
          <button className="bg-[#0784c3] hover:bg-[#066da2] text-white px-4 text-sm rounded-r">Search</button>
        </form>
      </div>
    </div>
  )
}

function SubNav(){
  const linkClass = ({isActive}:{isActive:boolean}) => 'px-3 py-2 text-sm rounded hover:bg-gray-100 ' + (isActive? 'text-[#0784c3] font-medium bg-gray-100' : 'text-gray-600')
  return (
    <div className="border-b bg-white dark:bg-[#141c2c] dark:border-[#1f2a3d]">
      <div className="max-w-7xl mx-auto px-4 flex items-center overflow-x-auto">
        <NavLink to="/" end className={linkClass}>Home</NavLink>
        <NavLink to="/blocks" className={linkClass}>Blocks</NavLink>
        <NavLink to="/txs" className={linkClass}>Transactions</NavLink>
        <NavLink to="/domains" className={linkClass}>Domains</NavLink>
        <NavLink to="/marketplace" className={linkClass}>Marketplace</NavLink>
        <NavLink to="/analytics" className={linkClass}>Analytics</NavLink>
      </div>
    </div>
  )
}

function SiteFooter(){
  return (
    <footer className="bg-white dark:bg-[#141c2c] border-t dark:border-[#1f2a3d] text-xs text-gray-500 dark:text-gray-400">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>&copy; {new Date().getFullYear()} DomaScan Testnet</div>
        <div className="flex gap-4">
          <Link to="/">Docs</Link>
          <Link to="/">Status</Link>
          <Link to="/">GitHub</Link>
        </div>
      </div>
    </footer>
  )
}
