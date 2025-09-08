import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class AnalyticsService {
    constructor(private readonly db: PrismaService) { }

    async txVolume(hours = 24) {
        const since = new Date(Date.now() - hours * 3600 * 1000);
        const txs = await (this.db as any).transaction.count({ where: { createdAt: { gte: since } } });
        const blocks = await (this.db as any).block.count({ where: { timestamp: { gte: since } } });
        // Compute simple notional volume from sale-type activities in the window
        // Approximate price from latest non-cancelled listing/offer around the event token
        const acts: any[] = await (this.db as any).activity.findMany({ where: { timestamp: { gte: since } } });
        let sales = 0n; // legacy combined figure (not currency-aware)
        const byCurrency: Record<string, bigint> = {};
        const saleTypes = new Set(['sale', 'transfer_sale', 'buy', 'fill', 'match']);
        for (const a of acts) {
            const t = String(a.type || '').toLowerCase();
            if (!saleTypes.has(t)) continue;
            const token = await (this.db as any).token.findUnique({ where: { id: a.tokenId }, include: { listings: true, offers: true } });
            if (!token) continue;
            // prefer matching listing (ask) price if available; fallback to highest offer
            let price: bigint | null = null;
            let currency: string | null = null;
            for (const l of token.listings || []) {
                if (String(l.status || '').toLowerCase().includes('cancel')) continue;
                price = BigInt(String(l.price));
                currency = String(l.currency || '').toUpperCase();
                break;
            }
            if (price === null) {
                for (const o of token.offers || []) {
                    if (String(o.status || '').toLowerCase().includes('cancel')) continue;
                    price = BigInt(String(o.price));
                    currency = String(o.currency || '').toUpperCase();
                    break;
                }
            }
            if (price !== null) {
                sales += price;
                if (currency) byCurrency[currency] = (byCurrency[currency] || 0n) + price;
            }
        }
        // Return raw on-chain notional; frontend can convert using /rates
        const notionalByCurrency: Record<string, string> = {};
        for (const [cur, amt] of Object.entries(byCurrency)) notionalByCurrency[cur] = amt.toString();
        return { since, txs, blocks, notional24h: sales.toString(), notionalByCurrency };
    }

    async trendingTlds(hours = 24) {
        const since = new Date(Date.now() - hours * 3600 * 1000);
        const tokens: any[] = await (this.db as any).token.findMany({
            where: { createdAt: { gte: since } },
            include: { name: true },
        });
        const counts: Record<string, number> = {};
        for (const t of tokens) {
            const tld = t.name?.tld ?? '';
            counts[tld] = (counts[tld] || 0) + 1;
        }
        const items = Object.entries(counts)
            .map(([tld, count]) => ({ tld, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
        return { since, items };
    }

    async keywordTrends(hours = 24) {
        const since = new Date(Date.now() - hours * 3600 * 1000);
        const names: any[] = await (this.db as any).name.findMany({ where: { createdAt: { gte: since } } });
        const counts: Record<string, number> = {};
        for (const n of names) {
            const parts = n.sld.split(/[-_]/).filter(Boolean);
            for (const p of parts) counts[p.toLowerCase()] = (counts[p.toLowerCase()] || 0) + 1;
        }
        const items = Object.entries(counts)
            .map(([keyword, count]) => ({ keyword, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
        return { since, items };
    }

    async popularDomains(hours = 24) {
        const since = new Date(Date.now() - hours * 3600 * 1000);
        const activities: any[] = await (this.db as any).activity.findMany({ where: { timestamp: { gte: since } } });
        const score: Record<string, number> = {};
        for (const a of activities) {
            score[a.tokenId] = (score[a.tokenId] || 0) + 1;
        }
        const topTokenIds = Object.entries(score)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([id]) => id);
        const tokens: any[] = await (this.db as any).token.findMany({ where: { id: { in: topTokenIds } }, include: { name: true, listings: true, offers: true } });
        const items = tokens.map((t: any) => {
            // attach simple price summary similar to explorer.domain
            let bestAsk: { currency: string; price: string } | null = null;
            let bestBid: { currency: string; price: string } | null = null;
            for (const l of (t.listings as any[] || [])) {
                if (String(l.status || '').toLowerCase().includes('cancel')) continue;
                if (!bestAsk) bestAsk = { currency: l.currency, price: String(l.price) };
                else if (l.currency === bestAsk.currency && BigInt(String(l.price)) < BigInt(bestAsk.price)) bestAsk = { currency: l.currency, price: String(l.price) };
            }
            for (const o of (t.offers as any[] || [])) {
                if (String(o.status || '').toLowerCase().includes('cancel')) continue;
                if (!bestBid) bestBid = { currency: o.currency, price: String(o.price) };
                else if (o.currency === bestBid.currency && BigInt(String(o.price)) > BigInt(bestBid.price)) bestBid = { currency: o.currency, price: String(o.price) };
            }
            return { id: t.id, nameId: (t as any).nameId, name: (t as any).name, price: { bestAsk, bestBid } };
        });
        return { since, items };
    }

    async floorByTld() {
        // Compute floor ask (min) and top bid (max) per TLD across active listings/offers
        const tokens: any[] = await (this.db as any).token.findMany({ include: { name: true, listings: true, offers: true } });
        const byTld: Record<string, { floorAsk?: { currency: string; price: string }; floorBid?: { currency: string; price: string }; asks: number; bids: number }>
            = {};
        for (const t of tokens) {
            const tld = String(t?.name?.tld || '').toLowerCase();
            if (!(tld in byTld)) byTld[tld] = { asks: 0, bids: 0 } as any;
            // best ask for this token
            let ask: { currency: string; price: string } | null = null;
            for (const l of (t.listings as any[] || [])) {
                if (String(l.status || '').toLowerCase().includes('cancel')) continue;
                if (!ask) ask = { currency: l.currency, price: String(l.price) };
                else if (l.currency === ask.currency && BigInt(String(l.price)) < BigInt(ask.price)) ask = { currency: l.currency, price: String(l.price) };
            }
            if (ask) {
                const cur = ask.currency;
                const curFloor = byTld[tld].floorAsk;
                if (!curFloor || (curFloor.currency === cur && BigInt(ask.price) < BigInt(curFloor.price))) byTld[tld].floorAsk = ask;
                byTld[tld].asks += 1;
            }
            // best bid for this token
            let bid: { currency: string; price: string } | null = null;
            for (const o of (t.offers as any[] || [])) {
                if (String(o.status || '').toLowerCase().includes('cancel')) continue;
                if (!bid) bid = { currency: o.currency, price: String(o.price) };
                else if (o.currency === bid.currency && BigInt(String(o.price)) > BigInt(bid.price)) bid = { currency: o.currency, price: String(o.price) };
            }
            if (bid) {
                const cur = bid.currency;
                const curTop = byTld[tld].floorBid;
                if (!curTop || (curTop.currency === cur && BigInt(bid.price) > BigInt(curTop.price))) byTld[tld].floorBid = bid;
                byTld[tld].bids += 1;
            }
        }
        const items = Object.entries(byTld).map(([tld, v]) => ({ tld, floorAsk: v.floorAsk || null, floorBid: v.floorBid || null, domainsWithAsks: v.asks, domainsWithBids: v.bids }))
            .sort((a, b) => {
                // sort by floor ask ascending (ETH priority if same currency), then by domainsWithAsks desc
                const ap = a.floorAsk ? BigInt(a.floorAsk.price) : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
                const bp = b.floorAsk ? BigInt(b.floorAsk.price) : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
                if (ap !== bp) return ap < bp ? -1 : 1;
                return b.domainsWithAsks - a.domainsWithAsks;
            });
        return { items };
    }

    async liquidityByTld() {
        // Basic liquidity: counts of active listings/offers and average spread for domains that have both (same currency only)
        const tokens: any[] = await (this.db as any).token.findMany({ include: { name: true, listings: true, offers: true } });
        const acc: Record<string, { listings: number; offers: number; spreadSumEth18: bigint; spreadCount: number }>
            = {};
        for (const t of tokens) {
            const tld = String(t?.name?.tld || '').toLowerCase();
            if (!(tld in acc)) acc[tld] = { listings: 0, offers: 0, spreadSumEth18: 0n, spreadCount: 0 };
            const activeListings = (t.listings as any[] || []).filter((l) => !String(l.status || '').toLowerCase().includes('cancel'));
            const activeOffers = (t.offers as any[] || []).filter((o) => !String(o.status || '').toLowerCase().includes('cancel'));
            acc[tld].listings += activeListings.length;
            acc[tld].offers += activeOffers.length;
            if (activeListings.length && activeOffers.length) {
                // compute spread only when in same currency; prefer ETH if available
                const bestAskEth = activeListings.filter(l => String(l.currency).toUpperCase() === 'ETH').map(l => BigInt(String(l.price))).sort((a, b) => (a < b ? -1 : 1))[0];
                const bestBidEth = activeOffers.filter(o => String(o.currency).toUpperCase() === 'ETH').map(o => BigInt(String(o.price))).sort((a, b) => (a > b ? -1 : 1))[0];
                if (bestAskEth !== undefined && bestBidEth !== undefined) {
                    const spread = bestAskEth > bestBidEth ? bestAskEth - bestBidEth : 0n;
                    acc[tld].spreadSumEth18 += spread;
                    acc[tld].spreadCount += 1;
                }
            }
        }
        const items = Object.entries(acc).map(([tld, v]) => ({
            tld,
            listings: v.listings,
            offers: v.offers,
            avgSpreadEth: v.spreadCount ? (Number(v.spreadSumEth18) / 1e18) / v.spreadCount : 0,
            pairs: v.spreadCount,
        })).sort((a, b) => (b.listings + b.offers) - (a.listings + a.offers));
        return { items };
    }

    async salesByTld(hours = 24) {
        const since = new Date(Date.now() - hours * 3600 * 1000);
        const acts: any[] = await (this.db as any).activity.findMany({ where: { timestamp: { gte: since } } });
        const saleTypes = new Set(['sale', 'transfer_sale', 'buy', 'fill', 'match']);
        const by: Record<string, { count: number; notionalByCurrency: Record<string, bigint> }> = {};
        for (const a of acts) {
            const t = String(a.type || '').toLowerCase();
            if (!saleTypes.has(t)) continue;
            const token = await (this.db as any).token.findUnique({ where: { id: a.tokenId }, include: { name: true, listings: true, offers: true } });
            if (!token || !token.name) continue;
            const tld = String(token.name.tld || '').toLowerCase();
            if (!(tld in by)) by[tld] = { count: 0, notionalByCurrency: {} };
            // heuristic price
            let price: bigint | null = null; let currency: string | null = null;
            for (const l of token.listings || []) { if (String(l.status || '').toLowerCase().includes('cancel')) continue; price = BigInt(String(l.price)); currency = String(l.currency || '').toUpperCase(); break; }
            if (price === null) { for (const o of token.offers || []) { if (String(o.status || '').toLowerCase().includes('cancel')) continue; price = BigInt(String(o.price)); currency = String(o.currency || '').toUpperCase(); break; } }
            by[tld].count += 1;
            if (price !== null && currency) {
                const cur = currency;
                by[tld].notionalByCurrency[cur] = (by[tld].notionalByCurrency[cur] || 0n) + price;
            }
        }
        const items = Object.entries(by).map(([tld, v]) => ({ tld, count: v.count, notionalByCurrency: Object.fromEntries(Object.entries(v.notionalByCurrency).map(([k, amt]) => [k, amt.toString()])) }))
            .sort((a, b) => b.count - a.count);
        return { since, items };
    }

    async leaderboard(hours = 24) {
        const since = new Date(Date.now() - hours * 3600 * 1000);
        const acts: any[] = await (this.db as any).activity.findMany({ where: { timestamp: { gte: since } } });
        const saleTypes = new Set(['sale', 'transfer_sale', 'buy', 'fill', 'match']);
        const buyers: Record<string, { count: number; notionalByCurrency: Record<string, bigint> }> = {};
        const sellers: Record<string, { count: number; notionalByCurrency: Record<string, bigint> }> = {};
        for (const a of acts) {
            const typ = String(a.type || '').toLowerCase();
            if (!saleTypes.has(typ)) continue;
            const payload = a.payload || {};
            const ed = payload.eventData || payload || {};
            const buyer = String(ed.buyer || ed.fulfiller || ed.to || '').toLowerCase();
            const seller = String(ed.seller || ed.maker || ed.from || '').toLowerCase();
            const token = await (this.db as any).token.findUnique({ where: { id: a.tokenId }, include: { listings: true, offers: true } });
            let price: bigint | null = null; let currency: string | null = null;
            for (const l of token?.listings || []) { if (String(l.status || '').toLowerCase().includes('cancel')) continue; price = BigInt(String(l.price)); currency = String(l.currency || '').toUpperCase(); break; }
            if (price === null) { for (const o of token?.offers || []) { if (String(o.status || '').toLowerCase().includes('cancel')) continue; price = BigInt(String(o.price)); currency = String(o.currency || '').toUpperCase(); break; } }
            if (buyer) {
                if (!(buyer in buyers)) buyers[buyer] = { count: 0, notionalByCurrency: {} };
                buyers[buyer].count += 1;
                if (price !== null && currency) buyers[buyer].notionalByCurrency[currency] = (buyers[buyer].notionalByCurrency[currency] || 0n) + price;
            }
            if (seller) {
                if (!(seller in sellers)) sellers[seller] = { count: 0, notionalByCurrency: {} };
                sellers[seller].count += 1;
                if (price !== null && currency) sellers[seller].notionalByCurrency[currency] = (sellers[seller].notionalByCurrency[currency] || 0n) + price;
            }
        }
        const top = (rec: Record<string, { count: number; notionalByCurrency: Record<string, bigint> }>) => Object.entries(rec).map(([addr, v]) => ({
            address: addr,
            count: v.count,
            notionalByCurrency: Object.fromEntries(Object.entries(v.notionalByCurrency).map(([k, amt]) => [k, amt.toString()]))
        })).sort((a, b) => b.count - a.count).slice(0, 50);
        return { since, buyers: top(buyers), sellers: top(sellers) };
    }
}
