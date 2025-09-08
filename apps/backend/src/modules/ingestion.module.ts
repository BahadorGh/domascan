import { Module } from '@nestjs/common';
import { IngestionService } from '../services/ingestion.service.js';
import { DomaClient } from '../services/doma.client.js';
import { IngestionController } from '../rest/ingestion.controller.js';

@Module({
    providers: [IngestionService, DomaClient],
    controllers: [IngestionController],
})
export class IngestionModule { }
