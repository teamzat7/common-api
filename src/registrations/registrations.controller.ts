import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { CreateCheckoutRequest, PaymentStatus } from '../payments/payment.types';
import { MongoOrderService } from '../shared/mongo-order.service';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly orders: MongoOrderService) {}

  @Post()
  async create(@Body() body: CreateCheckoutRequest): Promise<Record<string, unknown>> {
    this.assertRegistrationRequest(body);

    const order = await this.orders.createTicketOrder(body);

    return {
      status: (order.paymentStatus ?? 'pending') as PaymentStatus,
      orderId: order.id,
      orderReference: order.orderReference,
      amount: Number(order.amount),
      currency: order.currency || 'INR',
      customer: body.customer
    };
  }

  private assertRegistrationRequest(body: CreateCheckoutRequest): void {
    if (!body?.amount || !body.customer?.email || !body.customer?.phone || !body.ticket?.name || !body.ticket.price) {
      throw new BadRequestException('amount, customer.email, customer.phone, ticket.name and ticket.price are required');
    }

    if (Number(body.amount) <= 0) {
      throw new BadRequestException('amount must be greater than zero');
    }
  }
}
