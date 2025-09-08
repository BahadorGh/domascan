import { Controller, Get, Post, Query } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service.js';
import { IngestionService } from '../services/ingestion.service.js';

@Controller('ingestion')
export class IngestionController {
    constructor(private readonly db: PrismaService, private readonly ingestor: IngestionService) { }

    @Get('cursor')
    async cursor() {
        const row = await this.db.eventCursor.findUnique({ where: { id: 1 } });
        return row ?? { id: 1, lastId: 0 };
    }

    @Post('reset')
    async reset(@Query('eventId') eventId?: string) {
        await this.ingestor.resetCursor(eventId ? Number(eventId) : 0);
        return { ok: true };
    }
}
