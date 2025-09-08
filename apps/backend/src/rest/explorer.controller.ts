import { Controller, Get, Param, Query } from '@nestjs/common';
import { createPublicClient, http } from 'viem';
import { PrismaService } from '../services/prisma.service.js';
import { ExplorerService } from '../services/explorer.service.js';

@Controller('explorer')
export class ExplorerController {
    constructor(private readonly db: PrismaService, private readonly explorer: ExplorerService) { }

    @Get('blocks')
    async blocks(
        @Query('limit') limit = '20',
        @Query('cursor') cursor?: string, // anchor cursor
        @Query('dir') dir: 'next' | 'prev' = 'next', // direction relative to cursor
        @Query('sort') sort: 'number_desc' | 'number_asc' = 'number_desc',
    ) {
        const takeBase = Math.min(parseInt(limit, 10) || 20, 100);
        const take = takeBase + 1; // over-fetch to detect more pages
        const orderDir = sort === 'number_desc' ? 'desc' : 'asc';

        if (dir === 'next') {
            const rows = await (this.db as any).block.findMany({
                orderBy: { number: orderDir },
                take,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { number: BigInt(cursor) } : undefined,
            });
            const hasMore = rows.length > takeBase;
            const items = hasMore ? rows.slice(0, takeBase) : rows;
            const first = items[0];
            const last = items[items.length - 1];
            // next cursor depends on ordering direction
            const nextCursor = last ? String(last.number) : null;
            // previous cursor only available if we had a cursor (i.e., not first page)
            // or if there are rows before current first; we detect by running a look-back query when cursor provided
            let prevCursor: string | null = null;
            if (cursor) {
                prevCursor = first ? String(first.number) : null; // anchor on first item for prev fetch
            } else {
                // at first page (top) no previous
                prevCursor = null;
            }
            return { items, nextCursor: hasMore ? nextCursor : null, prevCursor };
        } else { // dir === 'prev'
            // To get previous page we invert ordering, fetch forward, then reverse back
            const inverseOrder = orderDir === 'desc' ? 'asc' : 'desc';
            const rows = await (this.db as any).block.findMany({
                orderBy: { number: inverseOrder },
                take,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { number: BigInt(cursor) } : undefined,
            });
            const hasMore = rows.length > takeBase;
            const slice = hasMore ? rows.slice(0, takeBase) : rows;
            // Reverse to maintain requested sort order
            const items = slice.reverse();
            const first = items[0];
            const last = items[items.length - 1];
            // For a prev fetch, nextCursor still refers to the boundary for moving forward again
            const nextCursor = last ? String(last.number) : null;
            // prevCursor available if there are more older pages in that direction (hasMore)
            const prevCursor = hasMore && first ? String(first.number) : null;
            return { items, nextCursor, prevCursor };
        }
    }

    @Get('stats')
    async stats() {
        const latestBlock = await (this.db as any).block.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
        let remoteLatest: bigint | null = null;
        try {
            const chainId = Number(process.env.DOMA_CHAIN_ID ?? 97476);
            const rpc = process.env.DOMA_RPC_URL ?? 'https://rpc-testnet.doma.xyz';
            const client = createPublicClient({ chain: { id: chainId, name: 'Doma', nativeCurrency: { name: 'DOMA', symbol: 'DOMA', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } } as any, transport: http(rpc) });
            remoteLatest = await client.getBlockNumber();
        } catch { /* ignore */ }
        const txCount = await (this.db as any).transaction.count();
        // distinct domains via Name table if exists; fallback to distinct nameId in tokens
        let domainCount = 0;
        try {
            domainCount = await (this.db as any).name.count();
        } catch {
            const distinct = await (this.db as any).token.findMany({ distinct: ['nameId'], select: { nameId: true } });
            domainCount = distinct.length;
        }
        const latestStr = latestBlock ? String(latestBlock.number) : null;
        const lag = latestBlock && remoteLatest ? (remoteLatest - BigInt(latestBlock.number)) : null;
        return {
            latestBlock: latestStr,
            remoteLatest: remoteLatest ? remoteLatest.toString() : null,
            lag: lag !== null ? lag.toString() : null,
            txCount,
            domainCount,
            updatedAt: new Date()
        };
    }

    @Get('metrics')
    metrics() {
        return this.explorer.getMetrics();
    }

    @Get('blocks/:number')
    async block(@Param('number') number: string) {
        const block = await (this.db as any).block.findUnique({ where: { number: BigInt(number) }, include: { txs: true } });
        return block;
    }

    @Get('txs')
    async txs(
        @Query('limit') limit = '20',
        @Query('cursor') cursor?: string,
        @Query('dir') dir: 'next' | 'prev' = 'next',
        @Query('sort') sort: 'time_desc' | 'time_asc' = 'time_desc',
        @Query('status') status?: 'success' | 'fail',
        @Query('fromDate') fromDate?: string,
        @Query('toDate') toDate?: string,
    ) {
        const takeBase = Math.min(parseInt(limit, 10) || 20, 100);
        const take = takeBase + 1;
        const orderDir = sort === 'time_desc' ? 'desc' : 'asc';
        const where: any = {};
        if (status === 'success') where.success = true;
        if (status === 'fail') where.success = false;
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = new Date(fromDate);
            if (toDate) where.createdAt.lte = new Date(toDate);
        }

        if (dir === 'next') {
            const rows = await (this.db as any).transaction.findMany({
                where,
                orderBy: { createdAt: orderDir },
                take,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { hash: cursor } : undefined,
            });
            const hasMore = rows.length > takeBase;
            const items = hasMore ? rows.slice(0, takeBase) : rows;
            const first = items[0];
            const last = items[items.length - 1];
            const nextCursor = last ? last.hash : null;
            const prevCursor = cursor && first ? first.hash : null;
            return { items, nextCursor: hasMore ? nextCursor : null, prevCursor };
        } else {
            const inverseOrder = orderDir === 'desc' ? 'asc' : 'desc';
            const rows = await (this.db as any).transaction.findMany({
                where,
                orderBy: { createdAt: inverseOrder },
                take,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { hash: cursor } : undefined,
            });
            const hasMore = rows.length > takeBase;
            const slice = hasMore ? rows.slice(0, takeBase) : rows;
            const items = slice.reverse();
            const first = items[0];
            const last = items[items.length - 1];
            const nextCursor = last ? last.hash : null; // forward direction anchor
            const prevCursor = hasMore && first ? first.hash : null;
            return { items, nextCursor, prevCursor };
        }
    }

    @Get('txs/:hash')
    async tx(@Param('hash') hash: string) {
        return (this.db as any).transaction.findUnique({ where: { hash } });
    }

    @Get('address/:addr')
    async address(@Param('addr') addr: string) {
        const txs = await (this.db as any).transaction.findMany({ where: { OR: [{ from: addr }, { to: addr }] }, orderBy: { createdAt: 'desc' }, take: 100 });
        const tokens = await (this.db as any).token.findMany({ where: { owner: addr }, take: 100, include: { name: true } });
        return { txs, tokens };
    }

    @Get('search')
    async search(@Query('q') q: string) {
        if (!q) return { results: [] };
        // tx hash
        if (q.startsWith('0x') && q.length === 66) {
            const tx = await (this.db as any).transaction.findUnique({ where: { hash: q } });
            return { results: tx ? [{ type: 'tx', hash: tx.hash }] : [] };
        }
        // block number
        if (/^\d+$/.test(q)) {
            const num = BigInt(q);
            const block = await (this.db as any).block.findUnique({ where: { number: num } });
            return { results: block ? [{ type: 'block', number: String(block.number) }] : [] };
        }
        if (q.includes('.')) {
            const name = await (this.db as any).name.findUnique({ where: { id: q } });
            return { results: name ? [{ type: 'domain', id: name.id }] : [] };
        }
        return { results: [] };
    }

    @Get('domains')
    async domains(
        @Query('limit') limit = '20',
        @Query('cursor') cursor?: string,
        @Query('dir') dir: 'next' | 'prev' = 'next',
        @Query('q') q?: string,
        @Query('sort') sort: 'name_asc' | 'name_desc' = 'name_asc',
        @Query('minPrice') minPrice?: string,
        @Query('maxPrice') maxPrice?: string,
        @Query('priceCur') priceCur?: string,
    ) {
        const takeBase = Math.min(parseInt(limit, 10) || 20, 100);
        const take = takeBase + 1;
        const orderDir = sort === 'name_asc' ? 'asc' : 'desc';

        const fetch = async (effectiveOrder: 'asc' | 'desc') => {
            return (this.db as any).token.findMany({
                where: q ? { nameId: { contains: q, mode: 'insensitive' } } : {},
                include: { name: true },
                distinct: ['nameId'],
                orderBy: { nameId: effectiveOrder },
                take,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { nameId: cursor } : undefined,
            });
        };

        let rows: any[];
        let invert = false;
        if (dir === 'next') {
            rows = await fetch(orderDir);
        } else { // prev
            const inverseOrder = orderDir === 'asc' ? 'desc' : 'asc';
            rows = await fetch(inverseOrder);
            invert = true;
        }
        const hasMore = rows.length > takeBase;
        let slice = hasMore ? rows.slice(0, takeBase) : rows;
        if (invert) slice = slice.reverse();

        const items = [] as any[];
        // Batch aggregation via raw SQL to avoid N+1
        const nameIds = slice.map(r => r.nameId);
        if (nameIds.length) {
            // NOTE: Adjust table & column names as per actual schema if different.
            const placeholders = nameIds.map((_, i) => `$${i + 1}`).join(',');
            // Listings: pick min active price per currency for ask; Offers: pick max active price per currency for bid
            const listingRows = await (this.db as any).$queryRawUnsafe(`
                SELECT t."nameId" as nameId, l."currency" as currency, MIN(l."price") as min_price
                FROM "Token" t
                JOIN "Listing" l ON l."tokenId" = t."id" AND LOWER(COALESCE(l."status",'')) NOT LIKE '%cancel%'
                WHERE t."nameId" IN (${placeholders})
                GROUP BY t."nameId", l."currency";
            `, ...nameIds);
            const offerRows = await (this.db as any).$queryRawUnsafe(`
                SELECT t."nameId" as nameId, o."currency" as currency, MAX(o."price") as max_price
                FROM "Token" t
                JOIN "Offer" o ON o."tokenId" = t."id" AND LOWER(COALESCE(o."status",'')) NOT LIKE '%cancel%'
                WHERE t."nameId" IN (${placeholders})
                GROUP BY t."nameId", o."currency";
            `, ...nameIds);
            const listingMap = new Map<string, any[]>();
            const offerMap = new Map<string, any[]>();
            for (const r of listingRows) {
                if (!listingMap.has(r.nameId)) listingMap.set(r.nameId, []);
                listingMap.get(r.nameId)!.push(r);
            }
            for (const r of offerRows) {
                if (!offerMap.has(r.nameId)) offerMap.set(r.nameId, []);
                offerMap.get(r.nameId)!.push(r);
            }
            for (const row of slice) {
                const nameId = row.nameId;
                let bestAsk: { currency: string; price: string } | null = null;
                let bestBid: { currency: string; price: string } | null = null;
                const lset = listingMap.get(nameId) || [];
                const oset = offerMap.get(nameId) || [];
                for (const l of lset) {
                    if (!bestAsk) bestAsk = { currency: l.currency, price: String(l.min_price) };
                    else if (l.currency === bestAsk.currency && BigInt(String(l.min_price)) < BigInt(bestAsk.price)) bestAsk = { currency: l.currency, price: String(l.min_price) };
                }
                for (const o of oset) {
                    if (!bestBid) bestBid = { currency: o.currency, price: String(o.max_price) };
                    else if (o.currency === bestBid.currency && BigInt(String(o.max_price)) > BigInt(bestBid.price)) bestBid = { currency: o.currency, price: String(o.max_price) };
                }
                // Apply price filters if provided
                let include = true;
                if (priceCur) {
                    const cur = priceCur.toUpperCase();
                    const relevant = bestAsk?.currency?.toUpperCase() === cur ? bestAsk : (bestBid?.currency?.toUpperCase() === cur ? bestBid : null);
                    if (relevant) {
                        const val = BigInt(relevant.price);
                        if (minPrice && val < BigInt(minPrice)) include = false;
                        if (maxPrice && val > BigInt(maxPrice)) include = false;
                    } else if (minPrice || maxPrice) {
                        include = false;
                    }
                }
                if (include) items.push({ nameId, name: row.name, bestAsk, bestBid });
            }
        }
        const first = items[0];
        const last = items[items.length - 1];
        const nextCursor = hasMore && last ? last.nameId : null;
        const prevCursor = cursor && first ? first.nameId : null;
        return { items, nextCursor, prevCursor };
    }

    @Get('domain/:id')
    async domain(@Param('id') id: string) {
        const name = await (this.db as any).name.findUnique({ where: { id } });
        if (!name) return null;
        const tokens = await (this.db as any).token.findMany({ where: { nameId: id }, include: { listings: true, offers: true } });
        const tokenIds = tokens.map((t: any) => t.id);
        const activities = tokenIds.length
            ? await (this.db as any).activity.findMany({ where: { tokenId: { in: tokenIds } }, orderBy: { timestamp: 'desc' }, take: 200 })
            : [];
        // price summary
        let bestAsk: { currency: string; price: string } | null = null;
        let bestBid: { currency: string; price: string } | null = null;
        for (const t of tokens) {
            for (const l of (t.listings || [])) {
                if (String(l.status || '').toLowerCase().includes('cancel')) continue;
                if (!bestAsk) bestAsk = { currency: l.currency, price: String(l.price) };
                else if (l.currency === bestAsk.currency && BigInt(String(l.price)) < BigInt(bestAsk.price)) bestAsk = { currency: l.currency, price: String(l.price) };
            }
            for (const o of (t.offers || [])) {
                if (String(o.status || '').toLowerCase().includes('cancel')) continue;
                if (!bestBid) bestBid = { currency: o.currency, price: String(o.price) };
                else if (o.currency === bestBid.currency && BigInt(String(o.price)) > BigInt(bestBid.price)) bestBid = { currency: o.currency, price: String(o.price) };
            }
        }
        return { name, tokens, activities, price: { bestAsk, bestBid } };
    }

    // Paginated activities for a domain (by tokenIds)
    @Get('domain/:id/activities')
    async domainActivities(@Param('id') id: string, @Query('limit') limit = '50', @Query('cursor') cursor?: string) {
        const take = Math.min(parseInt(limit, 10) || 50, 200);
        const tokens = await (this.db as any).token.findMany({ where: { nameId: id }, select: { id: true } });
        const tokenIds = tokens.map((t: any) => t.id);
        if (!tokenIds.length) return { items: [], nextCursor: null };
        // Use id cursor for stable pagination (id is unique)
        const items = await (this.db as any).activity.findMany({
            where: { tokenId: { in: tokenIds } },
            orderBy: { id: 'desc' },
            take,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
        });
        const nextCursor = items.length ? items[items.length - 1].id : null;
        return { items, nextCursor };
    }
}
