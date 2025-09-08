import { Module } from '@nestjs/common';
import { MarketplaceController } from '../rest/marketplace.controller.js';
import { DomaClient } from '../services/doma.client.js';

@Module({ controllers: [MarketplaceController], providers: [DomaClient] })
export class MarketplaceModule { }
