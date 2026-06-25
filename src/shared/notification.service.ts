import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

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

    if (this.smtpConfigured()) {
      await this.sendSmtp(recipients, subject, text);
      return;
    }

    await this.sendFormSubmit(recipients, subject, text, order, payment);
  }

  private async sendSmtp(recipients: string[], subject: string, text: string): Promise<void> {
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
      to: recipients,
      subject,
      text
    });
  }

  private async sendFormSubmit(
    recipients: string[],
    subject: string,
    text: string,
    order: RegistrationDocument & { id: string },
    payment: PaymentStatusResponse
  ): Promise<void> {
    await Promise.all(
      recipients.map(async recipient => {
        const formData = new FormData();
        formData.set('_subject', subject);
        formData.set('Message', text);
        formData.set('Order Reference', order.orderReference);
        formData.set('Order ID', order.id);
        formData.set('Name', order.name);
        formData.set('Customer Email', order.email);
        formData.set('Mobile', order.mobileNumber);
        formData.set('Company', order.company);
        formData.set('Designation', order.designation);
        formData.set('Ticket', order.ticketName);
        formData.set('Delegates', String(order.delegates));
        formData.set('Amount', `${order.currency} ${order.amount}`);
        formData.set('Payment Status', payment.status);
        formData.set('Payment ID', payment.providerPaymentId || '-');
        formData.set('Payment Order ID', payment.providerOrderId || '-');
        formData.set('Payment Method', payment.paymentMethod || '-');
        formData.set('Paid At', payment.paidAt || '-');

        const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: formData
        });

        if (!response.ok) {
          this.logger.warn(`FormSubmit email failed for ${recipient}: HTTP ${response.status}`);
        }
      })
    );
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
