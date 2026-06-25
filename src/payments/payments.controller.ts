import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';

import { CreateCheckoutRequest, PaymentStatus, PaymentStatusResponse, VerifyPaymentRequest } from './payment.types';
import { FirebaseAdminService } from '../shared/firebase-admin.service';
import { NotificationService } from '../shared/notification.service';
import { RazorpayPayment, RazorpayService } from '../shared/razorpay.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly notifications: NotificationService,
    private readonly razorpay: RazorpayService
  ) {}

  @Post('create-checkout')
  async createCheckout(@Body() body: CreateCheckoutRequest): Promise<Record<string, unknown>> {
    this.assertCheckoutRequest(body);

    const order = await this.firebase.ticketOrder(body.orderId);
    if (Number(order.amount) !== Number(body.amount)) {
      throw new BadRequestException('Amount does not match the saved ticket order');
    }

    const existingProviderOrderId = order.providerOrderId;
    const providerOrder = existingProviderOrderId
      ? await this.razorpay.fetchOrder(existingProviderOrderId)
      : await this.razorpay.createOrder({
          amount: body.amount,
          currency: body.currency || 'INR',
          receipt: body.orderReference,
          notes: {
            orderId: body.orderId,
            orderReference: body.orderReference,
            customerEmail: body.customer.email,
            customerPhone: body.customer.phone
          }
        });

    await this.firebase.attachProviderOrder(body.orderId, providerOrder.id);

    return {
      status: this.statusFromRazorpayOrder(providerOrder.status),
      provider: 'razorpay',
      providerOrderId: providerOrder.id,
      razorpayKeyId: this.razorpay.keyId(),
      amount: body.amount,
      currency: body.currency || 'INR',
      orderReference: body.orderReference,
      customer: body.customer,
      prefill: {
        name: body.customer.name,
        email: body.customer.email,
        contact: body.customer.phone
      },
      checkoutOptions: {
        name: 'Vizhinjam Logistics & Investment Summit 2026',
        description: body.description,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true
        },
        theme: {
          color: '#0b74d1'
        }
      },
      statusUrl: this.apiUrl('/payments/status')
    };
  }

  @Post('verify')
  async verify(@Body() body: VerifyPaymentRequest): Promise<PaymentStatusResponse> {
    this.assertVerifyRequest(body);

    if (!this.razorpay.verifyCheckoutSignature(body)) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    const payment = await this.razorpay.fetchPayment(body.providerPaymentId);
    if (payment.order_id !== body.providerOrderId) {
      throw new BadRequestException('Payment does not belong to the Razorpay order');
    }

    const beforeUpdate = await this.firebase.ticketOrder(body.orderId);
    const status = this.statusFromRazorpayPayment(payment);
    await this.firebase.markPayment(body.orderId, {
      status,
      providerOrderId: body.providerOrderId,
      providerPaymentId: body.providerPaymentId,
      paymentMethod: payment.method,
      amount: payment.amount / 100,
      currency: payment.currency,
      paidAt: this.epochToIso(payment.created_at),
      raw: payment
    });

    const response = await this.firebase.status(body.orderId);
    if (response.status === 'paid' && beforeUpdate.paymentStatus !== 'paid') {
      const order = await this.firebase.ticketOrder(body.orderId);
      await this.notifications.sendPaymentConfirmation(order, response);
    }

    return response;
  }

  @Get('status')
  async status(
    @Query('orderId') orderId: string,
    @Query('providerOrderId') providerOrderId?: string
  ): Promise<PaymentStatusResponse> {
    if (!orderId && !providerOrderId) {
      throw new BadRequestException('orderId or providerOrderId is required');
    }

    const order = orderId
      ? await this.firebase.ticketOrder(orderId)
      : await this.firebase.orderByProviderOrderId(String(providerOrderId));

    if (!order) {
      throw new BadRequestException('Order was not found');
    }

    if (order.paymentStatus === 'paid') {
      return this.firebase.status(order.id);
    }

    if (order.providerOrderId) {
      const providerOrder = await this.razorpay.fetchOrder(order.providerOrderId);
      const status = this.statusFromRazorpayOrder(providerOrder.status);
      if (status === 'failed' || status === 'cancelled') {
        await this.firebase.markPayment(order.id, {
          status,
          providerOrderId: order.providerOrderId,
          raw: providerOrder
        });
      }
    }

    return this.firebase.status(order.id);
  }

  @Post('webhook')
  async webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>
  ): Promise<{ received: true }> {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(body));
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid Razorpay webhook signature');
    }

    const event = String(body['event'] ?? '');
    const payment = this.extractWebhookPayment(body);
    if (!payment?.order_id) {
      return { received: true };
    }

    const order = await this.firebase.orderByProviderOrderId(payment.order_id);
    if (!order) {
      return { received: true };
    }

    const status = event.includes('failed') ? 'failed' : this.statusFromRazorpayPayment(payment);
    await this.firebase.markPayment(order.id, {
      status,
      providerOrderId: payment.order_id,
      providerPaymentId: payment.id,
      paymentMethod: payment.method,
      amount: payment.amount / 100,
      currency: payment.currency,
      paidAt: this.epochToIso(payment.created_at),
      raw: body
    });

    const response = await this.firebase.status(order.id);
    if (response.status === 'paid' && order.paymentStatus !== 'paid') {
      await this.notifications.sendPaymentConfirmation({ ...order, id: order.id }, response);
    }

    return { received: true };
  }

  private assertCheckoutRequest(body: CreateCheckoutRequest): void {
    if (!body?.orderId || !body.orderReference || !body.amount || !body.customer?.email || !body.customer?.phone) {
      throw new BadRequestException('orderId, orderReference, amount, customer.email and customer.phone are required');
    }

    if (Number(body.amount) <= 0) {
      throw new BadRequestException('amount must be greater than zero');
    }
  }

  private assertVerifyRequest(body: VerifyPaymentRequest): void {
    if (!body?.orderId || !body.providerOrderId || !body.providerPaymentId || !body.providerSignature) {
      throw new BadRequestException('orderId, providerOrderId, providerPaymentId and providerSignature are required');
    }
  }

  private extractWebhookPayment(body: Record<string, unknown>): RazorpayPayment | null {
    const payload = body['payload'] as Record<string, unknown> | undefined;
    const paymentWrapper = payload?.['payment'] as Record<string, unknown> | undefined;
    const entity = paymentWrapper?.['entity'] as RazorpayPayment | undefined;
    return entity ?? null;
  }

  private statusFromRazorpayOrder(status: string): PaymentStatus {
    if (status === 'paid') {
      return 'paid';
    }

    if (status === 'attempted') {
      return 'pending';
    }

    if (status === 'created') {
      return 'created';
    }

    return 'pending';
  }

  private statusFromRazorpayPayment(payment: RazorpayPayment): PaymentStatus {
    if (payment.status === 'captured' || payment.status === 'authorized') {
      return 'paid';
    }

    if (payment.status === 'failed') {
      return 'failed';
    }

    return 'pending';
  }

  private epochToIso(value: number): string {
    return new Date(value * 1000).toISOString();
  }

  private apiUrl(path: string): string {
    const base = (process.env['PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');
    return base ? `${base}${path}` : path;
  }
}
