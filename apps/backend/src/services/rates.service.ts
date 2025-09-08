import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import axios from 'axios'

type Rates = { usdPerEth?: number; usdPerDoma?: number; updatedAt?: Date }

@Injectable()
export class RatesService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('RatesService')
    private timer: NodeJS.Timeout | null = null
    private rates: Rates = {}

    private readonly refreshMs = Math.max(30000, Number(process.env.RATES_REFRESH_MS ?? '60000') || 60000)
    private readonly coingeckoBase = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3'
    private readonly domaId = process.env.DOMA_COINGECKO_ID || '' // Optional; leave empty if not listed

    async onModuleInit() {
        await this.refreshOnce()
        this.timer = setInterval(() => {
            this.refreshOnce().catch((e) => this.logger.warn(`refresh error: ${e?.message ?? e}`))
        }, this.refreshMs)
        this.logger.log(`Live rates refresher started (interval=${this.refreshMs}ms, domaId='${this.domaId || 'n/a'}')`)
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer)
        this.timer = null
    }

    get(): Rates {
        return this.rates
    }

    private async refreshOnce() {
        try {
            const ids = ['ethereum']
            if (this.domaId) ids.push(this.domaId)
            const url = `${this.coingeckoBase}/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`
            const { data } = await axios.get(url, { timeout: 8000, headers: { 'Accept': 'application/json' } })
            const usdPerEth = Number(data?.ethereum?.usd)
            const usdPerDoma = this.domaId ? Number(data?.[this.domaId]?.usd) : undefined
            if (Number.isFinite(usdPerEth)) this.rates.usdPerEth = usdPerEth
            if (this.domaId && Number.isFinite(usdPerDoma)) this.rates.usdPerDoma = usdPerDoma
            this.rates.updatedAt = new Date()
            if (!Number.isFinite(usdPerEth)) this.logger.warn('ETH price missing from provider response')
        } catch (e: any) {
            this.logger.warn(`Failed to fetch rates: ${e?.message ?? e}`)
        }
    }
}
