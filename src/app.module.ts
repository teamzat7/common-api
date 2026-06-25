import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EmailsController } from './emails/emails.controller';
import { HealthController } from './health.controller';
import { PaymentsController } from './payments/payments.controller';
import { FirebaseAdminService } from './shared/firebase-admin.service';
import { NotificationService } from './shared/notification.service';
import { RazorpayService } from './shared/razorpay.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, PaymentsController, EmailsController],
  providers: [FirebaseAdminService, NotificationService, RazorpayService]
})
export class AppModule {}
