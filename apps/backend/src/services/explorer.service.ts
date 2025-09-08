import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createPublicClient, http, PublicClient } from 'viem';

import { PrismaService } from './prisma.service.js';

const DOMA_CHAIN = {
    id: Number(process.env.DOMA_CHAIN_ID ?? 97476),
    name: 'Doma Testnet',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [process.env.DOMA_RPC_URL ?? 'https://rpc-testnet.doma.xyz'] } },
} as const;

@Injectable()
export class ExplorerService implements OnModuleInit {
    private readonly logger = new Logger('Explorer');
    private readonly rpcTimeoutMs: number = (() => {
        const v = Number(process.env.EXPLORER_RPC_TIMEOUT_MS ?? '12000');
        return Number.isFinite(v) && v > 0 ? v : 12000;
    })();
    private readonly rpcRetryCount: number = (() => {
        const v = Number(process.env.EXPLORER_RPC_RETRY_COUNT ?? '2');
        return Number.isFinite(v) && v >= 0 ? Math.min(v, 5) : 2;
    })();
    private readonly rpcRetryDelayMs: number = (() => {
        const v = Number(process.env.EXPLORER_RPC_RETRY_DELAY_MS ?? '200');
        return Number.isFinite(v) && v >= 0 ? Math.min(v, 5000) : 200;
    })();
    private rpcEndpoints: string[] = (() => {
        const list = (process.env.DOMA_RPC_URLS || process.env.DOMA_RPC_URL || 'https://rpc-testnet.doma.xyz')
            .split(/[\s,]+/)
            .map(s => s.trim())
            .filter(Boolean);
        return Array.from(new Set(list));
    })();
    private rpcClients: PublicClient[] = [];
    private rpcIndex = 0;
    private endpointState: Map<string, { fails: number; lastFail: number; cooldownUntil: number }> = new Map();
    private readonly endpointCooldownMs = 10000; // 10s cooldown after marked unhealthy
    private readonly globalRpcConcurrency: number = (() => {
        const v = Number(process.env.EXPLORER_GLOBAL_RPC_CONCURRENCY ?? '100');
        return Number.isFinite(v) && v > 0 ? Math.min(v, 500) : 100;
    })();
    private inFlightRpc = 0;
    private rpcWaiters: Array<() => void> = [];
    private readonly sliceJitterMs: number = (() => {
        const v = Number(process.env.EXPLORER_SLICE_JITTER_MS ?? '0');
        return Number.isFinite(v) && v >= 0 ? Math.min(v, 2000) : 0;
    })();
    private readonly basePollIntervalMs: number = (() => {
        const v = Number(process.env.EXPLORER_INTERVAL_MS ?? '2000');
        return Number.isFinite(v) && v > 0 ? v : 2000;
    })();
    private readonly backfillBlocks: bigint = (() => {
        const v = Number(process.env.EXPLORER_BACKFILL_BLOCKS ?? '50');
        return BigInt(Number.isFinite(v) && v > 0 ? v : 50);
    })();
    private readonly catchupConcurrency: number = (() => {
        const v = Number(process.env.EXPLORER_CATCHUP_CONCURRENCY ?? '5');
        return Number.isFinite(v) && v > 0 ? Math.min(v, 25) : 5; // cap to avoid overload
    })();
    private readonly catchupBatchSize: number = (() => {
        const v = Number(process.env.EXPLORER_CATCHUP_BATCH ?? '200');
        return Number.isFinite(v) && v > 0 ? Math.min(v, 5000) : 200;
    })();
    private readonly configuredMaxDynamicConcurrency: number = (() => {
        const v = Number(process.env.EXPLORER_MAX_DYNAMIC_CONCURRENCY ?? '60');
        return Number.isFinite(v) && v > 0 ? Math.min(v, 200) : 60;
    })();
    private runtimeMaxDynamicConcurrency = this.configuredMaxDynamicConcurrency;
    private readonly sliceParallelism: number = (() => {
        const v = Number(process.env.EXPLORER_SLICE_PARALLELISM ?? '4');
        return Number.isFinite(v) && v > 0 ? Math.min(v, 16) : 4;
    })();

    // Metrics / adaptive state
    private currentLag: bigint = 0n;
    private effectiveConcurrency = 1;
    private lastPollInterval = this.basePollIntervalMs;
    private readonly retryQueue: Set<bigint> = new Set();
    private retryCounts: Map<bigint, number> = new Map();
    private readonly maxRetryAttempts = 5;
    private readonly maxQueueSize = 5000;
    private rpcStats: { window: Array<boolean>; errors: number } = { window: [], errors: 0 };
    private readonly circuitWindowSize = 100;
    private readonly circuitErrorThresholdPct = 0.10; // 10%
    private circuitOpen = false;
    private circuitOpenedAt: number | null = null;
    private readonly circuitCooldownMs = 15000;

    constructor(private readonly db: PrismaService) { }

    async onModuleInit() {
        // build clients
        this.rpcClients = this.rpcEndpoints.map(url => createPublicClient({
            chain: DOMA_CHAIN,
            transport: http(url, {
                timeout: this.rpcTimeoutMs,
                retryCount: this.rpcRetryCount,
                retryDelay: this.rpcRetryDelayMs,
            })
        }) as PublicClient);
        this.rpcEndpoints.forEach(e => this.endpointState.set(e, { fails: 0, lastFail: 0, cooldownUntil: 0 }));
        const enable = (process.env.ENABLE_EXPLORER ?? 'true').toLowerCase() !== 'false';
        if (!enable) {
            this.logger.warn('Explorer tail disabled by ENABLE_EXPLORER=false');
            return;
        }
        // kick off tailing in background
        this.logger.log(`Explorer tail enabled (baseInterval=${this.basePollIntervalMs}ms, backfill=${this.backfillBlocks} blocks)`);
        this.tail().catch((e) => this.logger.error(e));
    }

    async tail() {
        while (true) {
            try {
                if (this.circuitOpen) {
                    const now = Date.now();
                    if (this.circuitOpenedAt && now - this.circuitOpenedAt > this.circuitCooldownMs) {
                        this.logger.warn('Circuit breaker cooldown elapsed; attempting close');
                        this.circuitOpen = false;
                        this.circuitOpenedAt = null;
                    } else {
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    }
                }
                const latest = await this.wrapRpc(client => client.getBlockNumber());
                const latestDb = await (this.db as any).block.findFirst({ orderBy: { number: 'desc' } });
                let next: bigint = latestDb ? BigInt(latestDb.number) + 1n : latest - this.backfillBlocks; // backfill window
                if (next < 0n) next = 0n;
                this.currentLag = latestDb ? (latest - BigInt(latestDb.number)) : (this.backfillBlocks);
                if (this.currentLag > 0n) this.logger.debug(`Block sync: local=${latestDb ? latestDb.number : 'none'} remote=${latest} lag=${this.currentLag}`);
                // drain retry queue first
                if (this.retryQueue.size) {
                    const toProcess = Array.from(this.retryQueue).slice(0, this.catchupBatchSize);
                    this.retryQueue.clear();
                    await this.processSlice(toProcess);
                }
                if (next <= latest) {
                    const range = { start: next, end: latest };
                    const total = Number(range.end - range.start + 1n);
                    const dynRaw = this.currentLag > 100000n ? this.catchupConcurrency * 5
                        : this.currentLag > 20000n ? this.catchupConcurrency * 3
                            : this.currentLag > 5000n ? this.catchupConcurrency * 2
                                : this.catchupConcurrency;
                    const dynConcurrency = Math.min(dynRaw, this.runtimeMaxDynamicConcurrency);
                    this.effectiveConcurrency = dynConcurrency;
                    if (total > 50 && dynConcurrency > 1) {
                        await this.catchUp(range.start, range.end, dynConcurrency);
                    } else {
                        for (let n = range.start; n <= range.end; n++) {
                            try {
                                await this.indexBlock(n, true);
                            } catch (e: any) {
                                this.logger.error(`Index block ${n} failed: ${e?.message ?? e}`);
                                this.enqueueRetry(n);
                                break; // allow retry next loop
                            }
                        }
                    }
                }
                // adjust dynamic throttle based on recent timeout pattern
                this.adjustThrottle();
                const interval = this.computeAdaptiveInterval();
                this.lastPollInterval = interval;
                await new Promise((r) => setTimeout(r, interval));
            } catch (e: any) {
                this.logger.error(`Tail error: ${e?.message ?? e}`);
                await new Promise((r) => setTimeout(r, Math.max(3000, this.basePollIntervalMs)));
            }
        }
    }

    private async catchUp(start: bigint, end: bigint, dynConcurrency: number) {
        const total = Number(end - start + 1n);
        this.logger.log(`Catch-up starting for ${total} blocks (${start} -> ${end}) with concurrency=${dynConcurrency}`);
        let processed = 0;
        for (let batchStart = start; batchStart <= end;) {
            const batchEnd = (() => {
                const candidate = batchStart + BigInt(this.catchupBatchSize) - 1n;
                return candidate > end ? end : candidate;
            })();
            const numbers: bigint[] = [];
            for (let n = batchStart; n <= batchEnd; n++) numbers.push(n);
            for (let i = 0; i < numbers.length; i += dynConcurrency * this.sliceParallelism) {
                const groupPromises: Promise<void>[] = [];
                for (let p = 0; p < this.sliceParallelism; p++) {
                    const offset = i + p * dynConcurrency;
                    if (offset >= numbers.length) break;
                    const slice = numbers.slice(offset, offset + dynConcurrency);
                    groupPromises.push(
                        (async () => {
                            await this.processSlice(slice).catch(e => this.logger.error(`Slice failed: ${e?.message ?? e}`));
                            processed += slice.length;
                        })()
                    );
                }
                await Promise.all(groupPromises);
            }
            batchStart = batchEnd + 1n;
            if (processed % 1000 === 0 || batchStart > end) {
                this.logger.log(`Catch-up progress: ${processed}/${total} (${((processed / total) * 100).toFixed(1)}%)`);
            }
        }
        this.logger.log('Catch-up complete');
    }

    private async processSlice(numbers: bigint[]) {
        if (this.sliceJitterMs) {
            const jitter = Math.floor(Math.random() * this.sliceJitterMs);
            if (jitter > 0) await new Promise(r => setTimeout(r, jitter));
        }
        const blocks = await Promise.all(numbers.map(n => this.wrapRpc(client => client.getBlock({ blockNumber: n, includeTransactions: true }))
            .catch(e => { this.logger.error(`Fetch block ${n} failed: ${e?.message ?? e}`); this.enqueueRetry(n); return null; })));
        const blockData: any[] = [];
        const txData: any[] = [];
        for (const blk of blocks) {
            if (!blk) continue;
            const ts = new Date(Number(blk.timestamp) * 1000);
            blockData.push({ number: blk.number, hash: blk.hash, parentHash: blk.parentHash, timestamp: ts, txCount: (blk as any).transactions.length });
            for (const tx of (blk as any).transactions) {
                txData.push({
                    hash: tx.hash,
                    blockNumber: blk.number,
                    from: tx.from,
                    to: tx.to ?? null,
                    value: (tx.value as any)?.toString?.() ?? String(tx.value),
                    success: true,
                    methodSig: tx.input && tx.input !== '0x' ? tx.input.slice(0, 10) : null,
                });
            }
        }
        if (!blockData.length) return;
        try {
            await (this.db as any).block.createMany({ data: blockData, skipDuplicates: true });
        } catch (e: any) {
            this.logger.warn(`Batch block insert partial failure: ${e?.message ?? e}; falling back to upserts`);
            for (const b of blockData) {
                try {
                    await (this.db as any).block.upsert({
                        where: { number: b.number },
                        create: b,
                        update: { hash: b.hash, parentHash: b.parentHash, timestamp: b.timestamp, txCount: b.txCount },
                    });
                } catch (err: any) {
                    this.logger.error(`Block upsert failed ${b.number}: ${err?.message ?? err}`);
                }
            }
        }
        if (txData.length) {
            try {
                await (this.db as any).transaction.createMany({ data: txData, skipDuplicates: true });
            } catch (e: any) {
                this.logger.warn(`Batch tx insert partial failure: ${e?.message ?? e}; falling back to individual upserts`);
                for (const tx of txData) {
                    try {
                        await (this.db as any).transaction.upsert({
                            where: { hash: tx.hash },
                            create: tx,
                            update: { blockNumber: tx.blockNumber, to: tx.to, value: tx.value, methodSig: tx.methodSig },
                        });
                    } catch (err: any) {
                        this.logger.error(`Tx upsert failed ${tx.hash}: ${err?.message ?? err}`);
                    }
                }
            }
        }
    }

    async indexBlock(number: bigint, includeTx: boolean) {
        const blk = await this.wrapRpc(client => client.getBlock({ blockNumber: number, includeTransactions: includeTx }));
        const ts = new Date(Number(blk.timestamp) * 1000);
        // transactions can be array of hashes (string) if includeTx=false
        const txCount = (blk as any).transactions?.length ?? 0;
        await (this.db as any).block.upsert({
            where: { number },
            create: {
                number,
                hash: blk.hash,
                parentHash: blk.parentHash,
                timestamp: ts,
                txCount,
            },
            update: { hash: blk.hash, parentHash: blk.parentHash, timestamp: ts, txCount },
        });
        if (!includeTx) return;
        const txs = (blk as any).transactions || [];
        if (!txs.length) return;
        // batch create transactions with skipDuplicates for speed
        const data = txs.map((tx: any) => ({
            hash: tx.hash,
            blockNumber: blk.number,
            from: tx.from,
            to: tx.to ?? null,
            value: (tx.value as any)?.toString?.() ?? String(tx.value),
            success: true,
            methodSig: tx.input && tx.input !== '0x' ? tx.input.slice(0, 10) : null,
        }));
        try {
            await (this.db as any).transaction.createMany({ data, skipDuplicates: true });
        } catch (e: any) {
            // Fallback to individual upserts if batch fails (e.g., due to rare constraint mismatch)
            this.logger.warn(`Batch tx insert failed for block ${number}: ${e?.message ?? e}; falling back to per-tx upserts`);
            for (const tx of data) {
                try {
                    await (this.db as any).transaction.upsert({
                        where: { hash: tx.hash },
                        create: tx,
                        update: { blockNumber: tx.blockNumber, to: tx.to, value: tx.value, methodSig: tx.methodSig },
                    });
                } catch (err: any) {
                    this.logger.error(`Tx upsert failed ${tx.hash}: ${err?.message ?? err}`);
                }
            }
        }
    }

    private computeAdaptiveInterval(): number {
        if (this.currentLag > 100000n) return 8000;
        if (this.currentLag > 20000n) return 5000;
        if (this.currentLag > 5000n) return 3000;
        if (this.currentLag > 200n) return Math.max(2000, this.basePollIntervalMs);
        return 1500;
    }

    private enqueueRetry(n: bigint) {
        const attempts = (this.retryCounts.get(n) || 0) + 1;
        if (attempts > this.maxRetryAttempts) {
            this.logger.warn(`Block ${n} exceeded max retries`);
            return;
        }
        if (this.retryQueue.size >= this.maxQueueSize) {
            const first = this.retryQueue.values().next().value;
            if (first !== undefined) this.retryQueue.delete(first);
        }
        this.retryCounts.set(n, attempts);
        this.retryQueue.add(n);
    }

    private selectClient(): { client: PublicClient; endpoint: string } {
        const now = Date.now();
        for (let i = 0; i < this.rpcEndpoints.length; i++) {
            const idx = (this.rpcIndex + i) % this.rpcEndpoints.length;
            const ep = this.rpcEndpoints[idx];
            const st = this.endpointState.get(ep)!;
            if (st.cooldownUntil > now) continue; // still cooling down
            this.rpcIndex = (idx + 1) % this.rpcEndpoints.length;
            return { client: this.rpcClients[idx], endpoint: ep };
        }
        // if all cooling, pick the first and ignore cooldown
        const ep = this.rpcEndpoints[this.rpcIndex];
        const idx = this.rpcIndex;
        this.rpcIndex = (this.rpcIndex + 1) % this.rpcEndpoints.length;
        return { client: this.rpcClients[idx], endpoint: ep };
    }

    private async acquireRpcSlot() {
        if (this.inFlightRpc < this.globalRpcConcurrency) { this.inFlightRpc++; return; }
        await new Promise<void>(res => this.rpcWaiters.push(res));
        this.inFlightRpc++;
    }
    private releaseRpcSlot() {
        this.inFlightRpc--;
        if (this.inFlightRpc < 0) this.inFlightRpc = 0;
        const next = this.rpcWaiters.shift();
        if (next) next();
    }

    private async wrapRpc<T>(fn: (client: PublicClient) => Promise<T>): Promise<T> {
        await this.acquireRpcSlot();
        const { client, endpoint } = this.selectClient();
        try {
            const res = await fn(client);
            this.recordRpcResult(true);
            this.markEndpointSuccess(endpoint);
            return res;
        } catch (e: any) {
            this.recordRpcResult(false);
            this.markEndpointFailure(endpoint, e);
            const msg = e?.message || '';
            if (typeof msg === 'string' && (msg.toLowerCase().includes('took too long') || msg.toLowerCase().includes('timeout'))) {
                this.recentTimeouts++;
            }
            throw e;
        } finally {
            this.releaseRpcSlot();
        }
    }

    private markEndpointFailure(endpoint: string, e: any) {
        const st = this.endpointState.get(endpoint);
        if (!st) return;
        st.fails++;
        st.lastFail = Date.now();
        if (st.fails >= 3) {
            st.cooldownUntil = Date.now() + this.endpointCooldownMs;
            this.logger.warn(`Endpoint ${endpoint} cooling down (${st.fails} fails)`);
            st.fails = 0; // reset after cooldown assignment
        }
    }
    private markEndpointSuccess(endpoint: string) {
        const st = this.endpointState.get(endpoint);
        if (!st) return;
        st.fails = 0;
        st.cooldownUntil = 0;
    }

    private recordRpcResult(ok: boolean) {
        this.rpcStats.window.push(ok);
        if (!ok) this.rpcStats.errors++;
        while (this.rpcStats.window.length > this.circuitWindowSize) {
            const removed = this.rpcStats.window.shift();
            if (removed === false) this.rpcStats.errors--;
        }
        const size = this.rpcStats.window.length;
        if (size >= this.circuitWindowSize) {
            const errs = this.rpcStats.errors;
            const rate = errs / size;
            if (rate > this.circuitErrorThresholdPct && !this.circuitOpen) {
                this.circuitOpen = true;
                this.circuitOpenedAt = Date.now();
                this.logger.error(`Circuit breaker OPEN (errorRate=${(rate * 100).toFixed(1)}% over last ${size})`);
            }
        }
    }

    // Throttle logic for timeouts
    private recentTimeouts = 0;
    private stableLoops = 0;
    private adjustThrottle() {
        if (this.recentTimeouts > 3) {
            // reduce concurrency aggressively but keep a floor
            const prev = this.runtimeMaxDynamicConcurrency;
            this.runtimeMaxDynamicConcurrency = Math.max(10, Math.floor(this.runtimeMaxDynamicConcurrency * 0.7));
            if (this.runtimeMaxDynamicConcurrency < prev) {
                this.logger.warn(`Throttling dynamic concurrency from ${prev} -> ${this.runtimeMaxDynamicConcurrency} due to RPC timeouts (${this.recentTimeouts})`);
            }
            this.recentTimeouts = 0; // reset after applying throttle
            this.stableLoops = 0;
        } else if (this.recentTimeouts === 0) {
            this.stableLoops++;
            // after a number of stable loops, gently restore concurrency toward configured max
            if (this.stableLoops >= 5 && this.runtimeMaxDynamicConcurrency < this.configuredMaxDynamicConcurrency) {
                const prev = this.runtimeMaxDynamicConcurrency;
                this.runtimeMaxDynamicConcurrency = Math.min(this.configuredMaxDynamicConcurrency, this.runtimeMaxDynamicConcurrency + 5);
                if (this.runtimeMaxDynamicConcurrency > prev) {
                    this.logger.log(`Restoring dynamic concurrency ${prev} -> ${this.runtimeMaxDynamicConcurrency}`);
                }
                this.stableLoops = 0;
            }
        } else {
            // some timeouts but not enough to trigger throttle; accumulate
            this.stableLoops = 0;
        }
        // Reset timeout counter each loop
        this.recentTimeouts = 0;
    }

    getMetrics() {
        const size = this.rpcStats.window.length;
        const errs = this.rpcStats.errors;
        const rate = size ? (errs / size) * 100 : 0;
        return {
            lag: this.currentLag.toString(),
            effectiveConcurrency: this.effectiveConcurrency,
            adaptiveIntervalMs: this.lastPollInterval,
            retryQueueSize: this.retryQueue.size,
            circuitOpen: this.circuitOpen,
            rpcWindow: size,
            rpcErrorsInWindow: errs,
            rpcErrorRatePct: rate,
            maxDynamicConcurrencyConfigured: this.configuredMaxDynamicConcurrency,
            maxDynamicConcurrencyRuntime: this.runtimeMaxDynamicConcurrency,
            rpcTimeoutMs: this.rpcTimeoutMs,
            activeRpcEndpoints: this.rpcEndpoints.length,
            globalRpcConcurrency: this.globalRpcConcurrency,
            inFlightRpc: this.inFlightRpc,
        };
    }
}
