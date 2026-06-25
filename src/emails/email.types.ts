export interface RegistrationEmailPayload {
  name: string;
  email: string;
  whatsappNumber?: string;
  mobileNumber: string;
  company: string;
  designation: string;
  interest?: string;
  message?: string;
}

export interface RegistrationEmailTicket {
  name: string;
  price: number;
}

export interface RegistrationEmailPayment {
  status: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  paymentMethod?: string;
  paidAt?: string;
}

export interface RegistrationEmailRequest {
  payload: RegistrationEmailPayload;
  ticket: RegistrationEmailTicket;
  totalAmount: number;
  orderReference: string;
  orderId: string;
  delegates: number;
  alreadyRegistered?: boolean;
  totalRegisteredCount?: number;
  payment?: RegistrationEmailPayment;
  adminEmails?: string[];
}
