import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DomaClient } from './doma.client.js';
import { PrismaService } from './prisma.service.js';

function toIdempotencyKey(e: any) {
    return e.uniqueId ?? `${e.type}:${e.eventData?.tokenAddress ?? ''}:${e.eventData?.tokenId ?? ''}:${e.eventData?.txHash ?? ''}`;
}

@Injectable()
export class IngestionService implements OnModuleInit {
    private readonly logger = new Logger('Ingestion');
    private running = false;

    constructor(private readonly doma: DomaClient, private readonly db: PrismaService) { }

    async onModuleInit() {
        const enable = (process.env.ENABLE_INGESTION ?? 'true').toLowerCase() !== 'false';
        const hasKey = !!(process.env.DOMA_API_KEY && process.env.DOMA_API_KEY.trim());
        if (!enable) {
            this.logger.warn('Ingestion disabled by ENABLE_INGESTION=false');
            return;
        }
        if (!hasKey) {
            this.logger.warn('DOMA_API_KEY is empty. Skipping Poll API ingestion.');
            return;
        }
        this.ensureCursor();
        this.start();
    }

    private async ensureCursor() {
        await this.db.eventCursor.upsert({ where: { id: 1 }, create: { id: 1, lastId: 0 }, update: {} });
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.loop().catch((e) => this.logger.error(e));
    }

    async loop() {
        while (this.running) {
            try {
                const { events, lastId, hasMoreEvents } = await this.doma.poll({ limit: 100, finalizedOnly: true });
                for (const ev of events) {
                    const key = toIdempotencyKey(ev);
                    const exists = await this.db.activity.findUnique({ where: { id: key } });
                    if (exists) continue;
                    await this.persistEvent(ev, key);
                }
                if (events.length > 0) {
                    await this.db.eventCursor.update({ where: { id: 1 }, data: { lastId } });
                    await this.doma.pollAck(lastId);
                }
                if (!hasMoreEvents) await new Promise((r) => setTimeout(r, 2000));
            } catch (e: any) {
                this.logger.error(`Poll error: ${e?.message ?? e}`);
                await new Promise((r) => setTimeout(r, 5000));
            }
        }
    }

    async resetCursor(eventId = 0) {
        await this.doma.pollReset(eventId);
        await this.db.eventCursor.update({ where: { id: 1 }, data: { lastId: eventId } });
    }

    private async persistEvent(ev: any, id: string) {
        const ed = ev.eventData || {};
        const tokenId = String(ed.tokenId ?? ev.tokenId ?? ev.id);
        const chainId = String(ed.networkId ?? ed.chainId ?? 'eip155:97476');
        const timestamp = ed.timestamp ? new Date(ed.timestamp) : new Date();
        const txHash = ed.txHash ?? null;
        const blockNumber = ed.blockNumber ? BigInt(ed.blockNumber) : null;
        // upsert Name
        if (ed.name) {
            const [sld, tld] = String(ed.name).split('.');
            const nameId = ed.name;
            await this.db.name.upsert({ where: { id: nameId }, create: { id: nameId, sld, tld }, update: { sld, tld } });
        }
        // upsert Token minimal
        if (tokenId) {
            const nameId = ed.name ?? `unknown.${chainId}`;
            await this.db.name.upsert({ where: { id: nameId }, create: { id: nameId, sld: nameId.split('.')[0] ?? 'unknown', tld: nameId.split('.')[1] ?? '' }, update: {} });
            await this.db.token.upsert({
                where: { id: tokenId },
                create: {
                    id: tokenId,
                    nameId,
                    owner: String(ed.owner ?? '0x0000000000000000000000000000000000000000'),
                    chainId,
                    claimed: false,
                    synthetic: false,
                },
                update: {
                    owner: ed.owner ?? undefined,
                    chainId,
                    lastActivityAt: new Date(),
                },
            });
        }

        await this.db.activity.create({
            data: {
                id,
                tokenId: tokenId,
                scopeType: 'token',
                type: String(ev.type ?? 'UNKNOWN'),
                txHash,
                blockNumber,
                timestamp,
                payload: ev,
            },
        });
    }
}
