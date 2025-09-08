import { Module } from '@nestjs/common';
import { SmtService } from '../services/smt.service.js';
import { SmtController } from '../rest/smt.controller.js';

@Module({ providers: [SmtService], controllers: [SmtController] })
export class SmtModule { }
