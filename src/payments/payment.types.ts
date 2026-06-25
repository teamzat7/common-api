export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'cancelled';

export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface CheckoutTicket {
  name: string;
  price: number;
  delegates: number;
}

export interface CreateCheckoutRequest {
  orderId: string;
  orderReference: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
  customer: CheckoutCustomer;
  ticket: CheckoutTicket;
}

export interface VerifyPaymentRequest {
  orderId: string;
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export interface PaymentStatusResponse {
  status: PaymentStatus;
  orderId: string;
  orderReference?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paymentMethod?: string;
  amount?: number;
  currency?: string;
  paidAt?: string;
}

export interface RegistrationDocument {
  orderReference: string;
  username: string;
  email: string;
  emailKey: string;
  whatsappNumber: string;
  mobileNumber: string;
  name: string;
  company: string;
  designation: string;
  ticketType: string;
  ticketName: string;
  ticketPrice: number;
  delegates: number;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentProvider: string;
  message?: string;
  interest?: string;
  orderId?: string;
  userId?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paymentMethod?: string;
  paidAt?: string;
}
