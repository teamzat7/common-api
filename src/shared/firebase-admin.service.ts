import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { cert, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { PaymentStatus, PaymentStatusResponse, RegistrationDocument } from '../payments/payment.types';

@Injectable()
export class FirebaseAdminService {
  private readonly db = this.initializeFirestore();

  async ticketOrder(orderId: string): Promise<RegistrationDocument & { id: string }> {
    const snapshot = await this.db.collection('ticketOrders').doc(orderId).get();
    if (!snapshot.exists) {
      throw new NotFoundException(`Ticket order ${orderId} was not found`);
    }

    return { id: snapshot.id, ...(snapshot.data() as RegistrationDocument) };
  }

  async registrationByOrderId(orderId: string): Promise<(RegistrationDocument & { id: string }) | null> {
    const snapshot = await this.db.collection('registrations').where('orderId', '==', orderId).limit(1).get();
    if (snapshot.empty) {
      return null;
    }

    const document = snapshot.docs[0];
    return { id: document.id, ...(document.data() as RegistrationDocument) };
  }

  async orderByProviderOrderId(providerOrderId: string): Promise<(RegistrationDocument & { id: string }) | null> {
    const snapshot = await this.db.collection('ticketOrders').where('providerOrderId', '==', providerOrderId).limit(1).get();
    if (snapshot.empty) {
      return null;
    }

    const document = snapshot.docs[0];
    return { id: document.id, ...(document.data() as RegistrationDocument) };
  }

  async attachProviderOrder(orderId: string, providerOrderId: string): Promise<void> {
    await this.updateOrderAndRegistration(orderId, {
      paymentProvider: 'razorpay',
      paymentStatus: 'created',
      providerOrderId,
      updatedAt: FieldValue.serverTimestamp()
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
      updatedAt: FieldValue.serverTimestamp()
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

  private async updateOrderAndRegistration(orderId: string, update: Record<string, unknown>): Promise<void> {
    const batch = this.db.batch();
    batch.set(this.db.collection('ticketOrders').doc(orderId), this.withoutUndefined(update), { merge: true });

    const registration = await this.registrationByOrderId(orderId);
    if (registration) {
      batch.set(this.db.collection('registrations').doc(registration.id), this.withoutUndefined(update), { merge: true });
    }

    await batch.commit();
  }

  private initializeFirestore(): FirebaseFirestore.Firestore {
    if (!getApps().length) {
      const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT_JSON']?.trim();
      const projectId = process.env['FIREBASE_PROJECT_ID']?.trim();

      if (serviceAccountJson) {
        initializeApp({
          credential: cert(JSON.parse(serviceAccountJson) as ServiceAccount),
          projectId
        });
      } else {
        initializeApp({ projectId });
      }
    }

    try {
      return getFirestore();
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : String(error));
    }
  }

  private withoutUndefined(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
  }
}
