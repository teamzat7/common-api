import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DashboardController } from './dashboard/dashboard.controller';
import { EmailsController } from './emails/emails.controller';
import { HealthController } from './health.controller';
import { LogsController } from './logs/logs.controller';
import { PaymentsController } from './payments/payments.controller';
import { RegistrationsController } from './registrations/registrations.controller';
import { MongoOrderService } from './shared/mongo-order.service';
import { NotificationService } from './shared/notification.service';
import { RazorpayService } from './shared/razorpay.service';
import { SponsorsController } from './sponsors/sponsors.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    HealthController,
    PaymentsController,
    RegistrationsController,
    EmailsController,
    SponsorsController,
    LogsController,
    DashboardController
  ],
  providers: [MongoOrderService, NotificationService, RazorpayService]
})
export class AppModule {}
