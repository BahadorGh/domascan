Blockchain Domain Explorer (DomaScan)

Overview
This is the DomaScan project: a full-stack analytics explorer for blockchain-based domains powered by the Doma Protocol. At this stage, it indexes blocks/transactions from Doma Testnet, ingests protocol events and marketplace data via Doma APIs, computes analytics, and exposes a verifiable, auditable index using a Sparse Merkle Tree (SMT). The frontend provides explorer views (blocks, transactions, addresses, domains), analytics dashboards, search, and marketplace browsing.

Stack
- Backend: NestJS (Node.js, TypeScript), Axios, viem (JSON-RPC), PostgreSQL (Prisma), Sparse Merkle Tree module, WebSocket updates
- Frontend: Vite + React + TypeScript, Tailwind CSS, React Router, TanStack Query, viem + wagmi + RainbowKit (WalletConnect)
- Doma Integrations: Poll API, Orderbook API, Doma Testnet RPC, optional Subgraph GraphQL

Monorepo layout
- apps/backend: NestJS API server and indexers
- apps/web: Vite React frontend
- prisma: database schema and migrations
- packages/shared: shared types and utilities

Requirements
- Node.js 18+
- pnpm or npm (npm v9+ recommended)
- PostgreSQL 14+

Environment variables
Copy .env.example to .env in apps/backend.

apps/backend/.env.example
DATABASE_URL="postgresql://doma:doma@localhost:5432/doma?schema=public"
DOMA_API_BASE="https://api-testnet.doma.xyz"
DOMA_GRAPHQL_ENDPOINT="https://api-testnet.doma.xyz/graphql"
DOMA_API_KEY="REPLACE_WITH_YOUR_API_KEY"
DOMA_RPC_URL="https://rpc-testnet.doma.xyz"
DOMA_CHAIN_ID=97476
PORT=4000
LOG_LEVEL=debug
ENABLE_EXPLORER=false   # true when RPC access is allowed
ENABLE_INGESTION=false  # true when DOMA_API_KEY is set

Install & setup
1) Install dependencies
   - At repo root:
     - pnpm install
   - Or with npm:
     - npm install

2) Start PostgreSQL
   - Option A: local service
   - Option B: docker (optional)
     docker run -e POSTGRES_PASSWORD=doma -e POSTGRES_USER=doma -e POSTGRES_DB=doma -p 5432:5432 -d postgres:14

3) Generate Prisma client and run migrations
   - pnpm -w exec prisma generate
   - pnpm -w exec prisma migrate deploy

4) Seed (optional, creates minimal indexes)
   - pnpm -w --filter @domascan/backend run seed

5) Run apps
   - Backend: pnpm -w --filter @domascan/backend run start:dev
   - Frontend: pnpm -w --filter @domascan/web run dev

Security notes
- Store DOMA_API_KEY securely. Backend expects it in server-side env.
- API key scopes: EVENTS, ORDERBOOK.

Key backend capabilities
- Block/tx indexer (via viem) from Doma Testnet RPC
- Doma Poll API ingestor with ack/reset, idempotent event store
- Marketplace integration via Orderbook API
- Analytics endpoints: volumes, hot TLDs, keyword trends, domain popularity
- Verifiable indexing: Sparse Merkle Tree over domainId -> hash(domain snapshot) with audit proofs
- Realtime updates over WebSockets

Key frontend features
- Block explorer (list/detail)
- Transaction explorer (list/detail)
- Address explorer (activity, owned domains)
- Domain explorer (portfolio, domain details)
- Analytics dashboard (charts, trending keywords/TLDs)
- Marketplace browser (listings/offers)
- Search bar with filters; responsive/mobile-friendly

Story: “Auditable, real-time analytics for tokenized domains with Doma.”
- Flow:
  1) Connect to Doma Testnet (RainbowKit), show wallet + chain switch.
  2) Show live Blocks/Tx tailing (new blocks appear), click into tx.
  3) Domains: show incoming NAME_TOKEN_MINTED events (via Poll API), click details.
  4) Analytics: show 24h volume, trending TLDs/keywords; filter by chain.
  5) Marketplace: browse current listings/offers; open listing detail (fees breakdown).
  6) Auditable index: request SMT proof for a domainId; verify client-side.
- Fallbacks: pre-index a few blocks and events; use cached analytics; demo proofs from a recent snapshot.
- Judges highlights: Doma integrations (RPC, Poll, Orderbook), verifiable analytics (SMT), multi-chain-ready architecture, responsive UI, clear docs.

Troubleshooting
- 401 from Doma APIs: ensure DOMA_API_KEY and required scopes.
- Empty data: indexers run continuously; wait a few seconds or trigger backfill endpoints.
- Prisma errors: check DATABASE_URL and run migrate deploy.
