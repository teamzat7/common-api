import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method?: string;
  captured?: boolean;
  created_at: number;
  email?: string;
  contact?: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly apiBase = 'https://api.razorpay.com/v1';

  async createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: input.receipt.slice(0, 40),
        payment_capture: 1,
        notes: input.notes
      })
    });
  }

  async fetchOrder(providerOrderId: string): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>(`/orders/${encodeURIComponent(providerOrderId)}`, { method: 'GET' });
  }

  async fetchPayment(providerPaymentId: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(`/payments/${encodeURIComponent(providerPaymentId)}`, { method: 'GET' });
  }

  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature: string;
  }): boolean {
    const expected = createHmac('sha256', this.requiredEnv('RAZORPAY_KEY_SECRET'))
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest('hex');

    return this.safeCompare(expected, input.providerSignature);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) {
      return false;
    }

    const expected = createHmac('sha256', this.requiredEnv('RAZORPAY_WEBHOOK_SECRET')).update(rawBody).digest('hex');
    return this.safeCompare(expected, signature);
  }

  keyId(): string {
    return this.requiredEnv('RAZORPAY_KEY_ID');
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const authorization = Buffer.from(`${this.requiredEnv('RAZORPAY_KEY_ID')}:${this.requiredEnv('RAZORPAY_KEY_SECRET')}`).toString('base64');
    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${authorization}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text();
      const parsedBody = this.parseErrorBody(body);
      this.logger.error(
        `Razorpay request failed with HTTP ${response.status}: ${body}`,
        undefined,
        RazorpayService.name
      );
      throw new BadRequestException({
        message: 'Razorpay request failed',
        razorpayStatus: response.status,
        razorpayError: parsedBody
      });
    }

    return (await response.json()) as T;
  }

  private parseErrorBody(body: string): unknown {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return body;
    }
  }

  private requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }
    return value;
  }

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
