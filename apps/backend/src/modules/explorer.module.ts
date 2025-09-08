import { Module } from '@nestjs/common';
import { ExplorerController } from '../rest/explorer.controller.js';
import { ExplorerService } from '../services/explorer.service.js';

@Module({
    controllers: [ExplorerController],
    providers: [ExplorerService],
})
export class ExplorerModule { }
