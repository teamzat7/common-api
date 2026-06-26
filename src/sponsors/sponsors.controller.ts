import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { MongoOrderService } from '../shared/mongo-order.service';

@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly orders: MongoOrderService) {}

  @Post()
  async create(@Body() body: Record<string, unknown>): Promise<{ saved: true }> {
    if (!body?.['name'] || !body['email'] || !body['phone'] || !body['company']) {
      throw new BadRequestException('name, email, phone and company are required');
    }

    await this.orders.saveSponsor(body);
    return { saved: true };
  }
}
