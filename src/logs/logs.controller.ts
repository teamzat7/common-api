import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { MongoOrderService } from '../shared/mongo-order.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly orders: MongoOrderService) {}

  @Post()
  async create(@Body() body: Record<string, unknown>): Promise<{ saved: true }> {
    await this.orders.saveLog(body);
    return { saved: true };
  }

  @Get()
  async recent(@Query('count') count?: string): Promise<Record<string, unknown>[]> {
    return this.orders.recentLogs(Math.min(Math.max(Number(count) || 20, 1), 100));
  }
}
