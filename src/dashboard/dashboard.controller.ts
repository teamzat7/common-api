import { Controller, Get } from '@nestjs/common';

import { MongoOrderService } from '../shared/mongo-order.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly orders: MongoOrderService) {}

  @Get('metrics')
  async metrics(): Promise<{ emailCount: number; registrationCount: number }> {
    return {
      emailCount: this.adminEmails().length,
      registrationCount: await this.orders.registrationCount()
    };
  }

  private adminEmails(): string[] {
    return (process.env['REGISTRATION_NOTIFICATION_EMAILS'] ?? '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean);
  }
}
