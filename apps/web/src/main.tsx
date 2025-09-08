import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, http } from 'wagmi'
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'

import RootLayout from './routes/RootLayout'
import { Suspense, lazy } from 'react'
const Home = lazy(()=> import('./routes/Home'))
const Blocks = lazy(()=> import('./routes/Blocks'))
const BlockDetail = lazy(()=> import('./routes/BlockDetail'))
const TxDetail = lazy(()=> import('./routes/TxDetail'))
const Address = lazy(()=> import('./routes/Address'))
const Domains = lazy(()=> import('./routes/Domains'))
const DomainDetail = lazy(()=> import('./routes/DomainDetail'))
const Analytics = lazy(()=> import('./routes/Analytics'))
const Marketplace = lazy(()=> import('./routes/Marketplace'))
const Transactions = lazy(()=> import('./routes/Transactions'))

const domaTestnet = {
  id: 97476,
  name: 'Doma Testnet',
  nativeCurrency: { name: 'DOMA', symbol: 'DOMA', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-testnet.doma.xyz'] },
    public: { http: ['https://rpc-testnet.doma.xyz'] },
  },
} as const

const wcProjectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID || '9d8fa0f3ee926cee967682be1f5e4f90'
const wagmiConfig = getDefaultConfig({
  appName: 'Doma Explorer',
  projectId: wcProjectId,
  chains: [domaTestnet as any],
  transports: {
    [domaTestnet.id]: http('https://rpc-testnet.doma.xyz'),
  },
  ssr: false,
})

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><Home /></Suspense> },
      { path: 'blocks', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><Blocks /></Suspense> },
      { path: 'txs', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><Transactions /></Suspense> },
      { path: 'blocks/:number', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><BlockDetail /></Suspense> },
      { path: 'tx/:hash', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><TxDetail /></Suspense> },
      { path: 'address/:addr', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><Address /></Suspense> },
      { path: 'domains', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><Domains /></Suspense> },
      { path: 'domain/:id', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><DomainDetail /></Suspense> },
      { path: 'analytics', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><Analytics /></Suspense> },
      { path: 'marketplace', element: <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}><Marketplace /></Suspense> },
    ],
  },
])

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <RouterProvider router={router} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
