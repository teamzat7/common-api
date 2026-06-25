import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

import { RegistrationEmailRequest } from '../emails/email.types';
import { PaymentStatusResponse, RegistrationDocument } from '../payments/payment.types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendPaymentConfirmation(order: RegistrationDocument & { id: string }, payment: PaymentStatusResponse): Promise<void> {
    if (payment.status !== 'paid') {
      return;
    }

    const recipients = this.unique([order.email, ...this.adminEmails()]);
    if (!recipients.length) {
      return;
    }

    const subject = `Vizhinjam Summit Registration & Payment - ${order.orderReference}`;
    const text = this.emailText(order, payment);

    await this.sendSmtp(recipients, subject, text);
  }

  async sendRegistrationEmail(request: RegistrationEmailRequest): Promise<void> {
    const customerEmail = request.payload.email.trim();
    const admins = this.unique([...(request.adminEmails ?? []), ...this.adminEmails()]);
    const payment = request.payment;

    if (request.alreadyRegistered) {
      await this.sendSmtp(
        [customerEmail],
        'Vizhinjam Summit registration already exists',
        this.customerRegistrationEmailText(request, true)
      );
      return;
    }

    if (admins.length) {
      await this.sendSmtp(
        admins,
        `Vizhinjam Summit Registration - ${request.payload.name}`,
        this.adminRegistrationEmailText(request)
      );
    }

    await this.sendSmtp(
      [customerEmail],
      payment?.status === 'paid' ? 'Vizhinjam Summit registration confirmed' : 'Vizhinjam Summit registration received',
      this.customerRegistrationEmailText(request, false)
    );
  }

  private async sendSmtp(recipients: string[], subject: string, text: string): Promise<void> {
    const to = this.unique(recipients);
    if (!to.length) {
      return;
    }

    if (!this.smtpConfigured()) {
      this.logger.warn(`SMTP is not configured. Skipping email: ${subject}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env['SMTP_HOST'],
      port: Number(process.env['SMTP_PORT'] ?? 587),
      secure: String(process.env['SMTP_SECURE'] ?? 'false') === 'true',
      auth: process.env['SMTP_USER']
        ? {
            user: process.env['SMTP_USER'],
            pass: process.env['SMTP_PASS']
          }
        : undefined
    });

    await transporter.sendMail({
      from: process.env['MAIL_FROM'] || 'Vizhinjam Summit <no-reply@vizhinjamsummit.com>',
      to,
      subject,
      text
    });
  }

  private emailText(order: RegistrationDocument & { id: string }, payment: PaymentStatusResponse): string {
    return [
      'Payment completed successfully. Your Vizhinjam Logistics & Investment Summit 2026 registration is confirmed.',
      '',
      `Order Reference: ${order.orderReference}`,
      `Order ID: ${order.id}`,
      `Payment ID: ${payment.providerPaymentId ?? '-'}`,
      `Payment Method: ${payment.paymentMethod ?? '-'}`,
      `Paid At: ${payment.paidAt ?? '-'}`,
      '',
      `Name: ${order.name}`,
      `Email: ${order.email}`,
      `Mobile: ${order.mobileNumber}`,
      `Company: ${order.company}`,
      `Designation: ${order.designation}`,
      `Ticket: ${order.ticketName}`,
      `Delegates: ${order.delegates}`,
      `Amount: ${order.currency} ${order.amount}`
    ].join('\n');
  }

  private adminRegistrationEmailText(request: RegistrationEmailRequest): string {
    const payment = request.payment;
    return [
      'New Vizhinjam Logistics & Investment Summit 2026 registration received.',
      '',
      `Order Reference: ${request.orderReference}`,
      `Order ID: ${request.orderId}`,
      `Total Registered Count: ${request.totalRegisteredCount ?? '-'}`,
      '',
      `Name: ${request.payload.name}`,
      `Email: ${request.payload.email}`,
      `Mobile: ${request.payload.mobileNumber}`,
      `WhatsApp: ${request.payload.whatsappNumber || '-'}`,
      `Company: ${request.payload.company}`,
      `Designation: ${request.payload.designation}`,
      `Interest: ${request.payload.interest || '-'}`,
      `Message: ${request.payload.message || '-'}`,
      '',
      `Ticket: ${request.ticket.name}`,
      `Delegates: ${request.delegates}`,
      `Amount: INR ${request.totalAmount}`,
      '',
      `Payment Status: ${payment?.status ?? 'pending'}`,
      `Payment ID: ${payment?.providerPaymentId || '-'}`,
      `Payment Order ID: ${payment?.providerOrderId || '-'}`,
      `Payment Method: ${payment?.paymentMethod || '-'}`,
      `Paid At: ${payment?.paidAt || '-'}`
    ].join('\n');
  }

  private customerRegistrationEmailText(request: RegistrationEmailRequest, alreadyRegistered: boolean): string {
    const payment = request.payment;
    return [
      alreadyRegistered
        ? 'You have already registered for Vizhinjam Logistics & Investment Summit 2026. Your registration details are below.'
        : payment?.status === 'paid'
          ? 'Payment completed successfully. Your Vizhinjam Logistics & Investment Summit 2026 registration is confirmed.'
          : 'Your Vizhinjam Logistics & Investment Summit 2026 registration has been received.',
      '',
      `Order Reference: ${request.orderReference}`,
      `Order ID: ${request.orderId}`,
      `Name: ${request.payload.name}`,
      `Email: ${request.payload.email}`,
      `Mobile: ${request.payload.mobileNumber}`,
      `Ticket: ${request.ticket.name}`,
      `Delegates: ${request.delegates}`,
      `Amount: INR ${request.totalAmount}`,
      `Payment Status: ${payment?.status ?? 'pending'}`,
      `Payment ID: ${payment?.providerPaymentId || '-'}`,
      `Payment Method: ${payment?.paymentMethod || '-'}`,
      '',
      'Website: https://www.vizhinjamsummit.com'
    ].join('\n');
  }

  private adminEmails(): string[] {
    return (process.env['REGISTRATION_NOTIFICATION_EMAILS'] ?? '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean);
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
  }

  private smtpConfigured(): boolean {
    return Boolean(process.env['SMTP_HOST']?.trim());
  }
}
