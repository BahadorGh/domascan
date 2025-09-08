import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from '../rest/health.controller.js';
import { RatesController } from '../rest/rates.controller.js';
import { PrismaModule } from './prisma.module.js';
import { IngestionModule } from './ingestion.module.js';
import { AnalyticsModule } from './analytics.module.js';
import { SmtModule } from './smt.module.js';
import { MarketplaceModule } from './marketplace.module.js';
import { ExplorerModule } from './explorer.module.js';
import { RatesService } from '../services/rates.service.js';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        IngestionModule,
        AnalyticsModule,
        SmtModule,
        MarketplaceModule,
        ExplorerModule,
    ],
    controllers: [HealthController, RatesController],
    providers: [RatesService],
})
export class AppModule { }
