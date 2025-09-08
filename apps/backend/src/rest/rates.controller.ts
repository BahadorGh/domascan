import { Controller, Get } from '@nestjs/common'
import { RatesService } from '../services/rates.service.js'

@Controller('rates')
export class RatesController {
    constructor(private readonly rates: RatesService) { }

    @Get()
    get() {
        const r = this.rates.get()
        const envEth = Number(process.env.USD_PER_ETH ?? '3000')
        const envDoma = Number(process.env.USD_PER_DOMA ?? '1')
        return {
            usdPerEth: r.usdPerEth ?? envEth,
            usdPerDoma: r.usdPerDoma ?? envDoma,
            updatedAt: r.updatedAt ?? null,
        }
    }
}
