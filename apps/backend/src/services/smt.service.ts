import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { keccak256, toHex } from 'viem';

const TREE_HEIGHT = 256; // Sparse Merkle Tree over 256-bit space

function hashPair(a: `0x${string}`, b: `0x${string}`): `0x${string}` {
    return keccak256(toHex(Buffer.concat([Buffer.from(a.slice(2), 'hex'), Buffer.from(b.slice(2), 'hex')]))) as `0x${string}`;
}

@Injectable()
export class SmtService {
    constructor(private readonly db: PrismaService) { }

    async setLeaf(key: string, valueHash: `0x${string}`) {
        await this.db.smtLeaf.upsert({ where: { key }, create: { key, valueHash }, update: { valueHash } });
    }

    async getLeaf(key: string) {
        return this.db.smtLeaf.findUnique({ where: { key } });
    }

    async computeRoot(): Promise<`0x${string}`> {
        // For hackathon scale, fold all leaves deterministically; in production, use a proper sparse structure with default zeros
        const leaves = await this.db.smtLeaf.findMany();
        let acc: `0x${string}` = keccak256('0x');
        for (const l of leaves) {
            const hv = l.valueHash as `0x${string}`;
            acc = hashPair(acc, hv);
        }
        return acc;
    }

    async snapshot() {
        const root = await this.computeRoot();
        const snap = await this.db.smtSnapshot.create({ data: { root } });
        return snap;
    }

    async prove(key: string): Promise<{ key: string; valueHash: string; siblings: string[]; root: string }> {
        // Simple proof: return all other leaves hashed order as siblings (hackathon simplification)
        const leaf = await this.getLeaf(key);
        const all = await this.db.smtLeaf.findMany();
        const siblings = all.filter((x) => x.key !== key).map((x) => x.valueHash);
        const root = await this.computeRoot();
        return { key, valueHash: leaf?.valueHash ?? '0x', siblings, root };
    }
}
