import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service.js';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly svc: AnalyticsService) { }

    @Get('volume')
    volume(@Query('hours') hours = '24') {
        return this.svc.txVolume(Number(hours));
    }

    @Get('trending-tlds')
    trendingTlds(@Query('hours') hours = '24') {
        return this.svc.trendingTlds(Number(hours));
    }

    @Get('keywords')
    keywords(@Query('hours') hours = '24') {
        return this.svc.keywordTrends(Number(hours));
    }

    @Get('popular-domains')
    popularDomains(@Query('hours') hours = '24') {
        return this.svc.popularDomains(Number(hours));
    }

    @Get('floor-by-tld')
    floorByTld() {
        return this.svc.floorByTld();
    }

    @Get('liquidity-by-tld')
    liquidityByTld() {
        return this.svc.liquidityByTld();
    }

    @Get('sales-by-tld')
    salesByTld(@Query('hours') hours = '24') {
        return this.svc.salesByTld(Number(hours));
    }

    @Get('leaderboard')
    leaderboard(@Query('hours') hours = '24') {
        return this.svc.leaderboard(Number(hours));
    }
}
