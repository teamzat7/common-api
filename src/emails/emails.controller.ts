import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { RegistrationEmailRequest } from './email.types';
import { NotificationService } from '../shared/notification.service';

@Controller('emails')
export class EmailsController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('registration')
  async registration(@Body() body: RegistrationEmailRequest): Promise<{ sent: true }> {
    if (!body?.payload?.email || !body.payload.name || !body.ticket?.name || !body.orderReference || !body.orderId) {
      throw new BadRequestException('payload.email, payload.name, ticket.name, orderReference and orderId are required');
    }

    await this.notifications.sendRegistrationEmail(body);
    return { sent: true };
  }
}
