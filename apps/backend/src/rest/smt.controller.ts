import { Controller, Get, Param, Post } from '@nestjs/common';
import { SmtService } from '../services/smt.service.js';

@Controller('smt')
export class SmtController {
    constructor(private readonly smt: SmtService) { }

    @Get('proof/:key')
    async proof(@Param('key') key: string) {
        return this.smt.prove(key);
    }

    @Post('snapshot')
    async snapshot() {
        return this.smt.snapshot();
    }
}
