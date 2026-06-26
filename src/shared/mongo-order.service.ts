import { Injectable, InternalServerErrorException, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Collection, Db, MongoClient } from 'mongodb';

import { CreateCheckoutRequest, PaymentStatus, PaymentStatusResponse, RegistrationDocument } from '../payments/payment.types';

type StoredRegistration = RegistrationDocument & {
  id: string;
  source?: string;
  createdAt?: Date;
  updatedAt?: Date;
  paymentResponse?: unknown;
};

@Injectable()
export class MongoOrderService implements OnModuleDestroy {
  private clientPromise: Promise<MongoClient> | null = null;
  private dbPromise: Promise<Db> | null = null;

  async onModuleDestroy(): Promise<void> {
    if (this.clientPromise) {
      await (await this.clientPromise).close();
    }
  }

  async createTicketOrder(body: CreateCheckoutRequest): Promise<StoredRegistration> {
    const now = new Date();
    const orderId = body.orderId || randomUUID();
    const orderReference = body.orderReference || `VIZH-${Date.now()}-${this.phoneKey(body.customer.phone).slice(-4)}`;
    const registration = body.registration;
    const mobileNumber = registration?.mobileNumber || registration?.whatsappNumber || body.customer.phone;
    const emailKey = this.emailKey(body.customer.email);
    const ticketType = registration?.ticketType || this.ticketType(body.ticket.name);
    const document: StoredRegistration = {
      id: orderId,
      orderId,
      userId: this.phoneKey(mobileNumber),
      username: this.phoneKey(mobileNumber),
      orderReference,
      email: body.customer.email,
      emailKey,
      whatsappNumber: registration?.whatsappNumber || mobileNumber,
      mobileNumber,
      name: registration?.name || body.customer.name,
      company: registration?.company || '',
      designation: registration?.designation || '',
      ticketType,
      ticketName: body.ticket.name,
      ticketPrice: Number(body.ticket.price),
      delegates: Number(body.ticket.delegates || registration?.delegates || 1),
      amount: Number(body.amount),
      currency: body.currency || 'INR',
      paymentStatus: 'pending',
      paymentProvider: 'razorpay',
      message: registration?.message || '',
      interest: registration?.interest || '',
      source: 'vizhinjam-event-booking-api',
      createdAt: now,
      updatedAt: now
    };

    await (await this.ticketOrders()).updateOne(
      { id: orderId },
      { $setOnInsert: document },
      { upsert: true }
    );
    await (await this.registrations()).updateOne(
      { orderId },
      { $setOnInsert: document },
      { upsert: true }
    );
    await (await this.users()).updateOne(
      { username: document.username },
      {
        $set: {
          username: document.username,
          email: document.email,
          emailKey: document.emailKey,
          whatsappNumber: document.whatsappNumber,
          mobileNumber: document.mobileNumber,
          name: document.name,
          company: document.company,
          designation: document.designation,
          interest: document.interest,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    return this.ticketOrder(orderId);
  }

  async ticketOrder(orderId: string): Promise<StoredRegistration> {
    const order = await (await this.ticketOrders()).findOne({ id: orderId });
    if (!order) {
      throw new NotFoundException(`Ticket order ${orderId} was not found`);
    }

    return order;
  }

  async registrationByOrderId(orderId: string): Promise<StoredRegistration | null> {
    return (await this.registrations()).findOne({ orderId });
  }

  async orderByProviderOrderId(providerOrderId: string): Promise<StoredRegistration | null> {
    return (await this.ticketOrders()).findOne({ providerOrderId });
  }

  async attachProviderOrder(orderId: string, providerOrderId: string): Promise<void> {
    await this.updateOrderAndRegistration(orderId, {
      paymentProvider: 'razorpay',
      paymentStatus: 'created',
      providerOrderId,
      updatedAt: new Date()
    });
  }

  async markPayment(orderId: string, payment: {
    status: PaymentStatus;
    providerOrderId?: string;
    providerPaymentId?: string;
    paymentMethod?: string;
    amount?: number;
    currency?: string;
    paidAt?: string;
    raw?: unknown;
  }): Promise<void> {
    await this.updateOrderAndRegistration(orderId, {
      paymentStatus: payment.status,
      providerOrderId: payment.providerOrderId ?? null,
      providerPaymentId: payment.providerPaymentId ?? null,
      paymentMethod: payment.paymentMethod ?? null,
      paidAt: payment.status === 'paid' ? payment.paidAt ?? new Date().toISOString() : null,
      paymentResponse: payment.raw ?? null,
      updatedAt: new Date()
    });
  }

  async status(orderId: string): Promise<PaymentStatusResponse> {
    const order = await this.ticketOrder(orderId);
    return {
      status: order.paymentStatus ?? 'pending',
      orderId,
      orderReference: order.orderReference,
      providerOrderId: order.providerOrderId,
      providerPaymentId: order.providerPaymentId,
      paymentMethod: order.paymentMethod,
      amount: Number(order.amount),
      currency: order.currency,
      paidAt: order.paidAt
    };
  }

  async registrationCount(): Promise<number> {
    return (await this.registrations()).countDocuments();
  }

  async ping(): Promise<void> {
    await (await this.db()).command({ ping: 1 });
  }

  async saveSponsor(payload: Record<string, unknown>): Promise<void> {
    await (await this.sponsors()).insertOne({
      ...payload,
      source: 'vizhinjam-event-booking-api',
      createdAt: new Date()
    });
  }

  async saveLog(payload: Record<string, unknown>): Promise<void> {
    await (await this.logs()).insertOne({
      ...payload,
      source: 'vizhinjam-event-booking-api',
      createdAt: new Date()
    });
  }

  async recentLogs(count = 20): Promise<Record<string, unknown>[]> {
    return (await this.logs())
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(count)
      .toArray();
  }

  private async updateOrderAndRegistration(orderId: string, update: Record<string, unknown>): Promise<void> {
    const cleanUpdate = this.withoutUndefined(update);
    await (await this.ticketOrders()).updateOne({ id: orderId }, { $set: cleanUpdate });
    await (await this.registrations()).updateOne({ orderId }, { $set: cleanUpdate });
  }

  private async ticketOrders(): Promise<Collection<StoredRegistration>> {
    return this.collection<StoredRegistration>('ticketOrders');
  }

  private async registrations(): Promise<Collection<StoredRegistration>> {
    return this.collection<StoredRegistration>('registrations');
  }

  private async users(): Promise<Collection<Record<string, unknown>>> {
    return this.collection<Record<string, unknown>>('users');
  }

  private async sponsors(): Promise<Collection<Record<string, unknown>>> {
    return this.collection<Record<string, unknown>>('sponsorInquiries');
  }

  private async logs(): Promise<Collection<Record<string, unknown>>> {
    return this.collection<Record<string, unknown>>('appLogs');
  }

  private async collection<T extends object>(name: string): Promise<Collection<T>> {
    return (await this.db()).collection<T>(name);
  }

  private async db(): Promise<Db> {
    if (!this.dbPromise) {
      this.dbPromise = this.connect();
    }

    return this.dbPromise;
  }

  private async connect(): Promise<Db> {
    const uri = process.env['MONGODB_URI']?.trim();
    if (!uri) {
      throw new InternalServerErrorException('MONGODB_URI is not configured');
    }

    this.clientPromise ??= MongoClient.connect(uri);
    const client = await this.clientPromise;
    return client.db(process.env['MONGODB_DB']?.trim() || 'vizhinjam');
  }

  private ticketType(ticketName: string): string {
    return ticketName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'delegate';
  }

  private phoneKey(value: string): string {
    return value.replace(/[^\d+]/g, '').replace(/^\+/, '');
  }

  private emailKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private withoutUndefined(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
  }
}
