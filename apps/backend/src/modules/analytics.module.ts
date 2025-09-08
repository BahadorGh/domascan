import { Module } from '@nestjs/common';
import { AnalyticsController } from '../rest/analytics.controller.js';
import { AnalyticsService } from '../services/analytics.service.js';

@Module({ controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule { }
