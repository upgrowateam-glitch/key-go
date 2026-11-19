import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { FilesController } from './admin/files.controller';
import { UsersController } from './admin/users.controller';
import { DriverController } from './admin/driver.controller';
import { WhatsAppController } from './whatsapp/whatsapp.controller';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { MeController } from './customer/me.controller';
import { PublicController } from './customer/public.controller';
import { BookingsService } from './domain/bookings.service';
import { StoreService } from './domain/store.service';
import { StaffSyncService } from './domain/staff-sync.service';

/** The REST API used by the admin portal (/admin) and the customer app (/me, /public). */
@Module({
  controllers: [AdminController, UsersController, FilesController, DriverController, WhatsAppController, MeController, PublicController],
  providers: [StoreService, BookingsService, WhatsAppService, StaffSyncService],
})
export class ApiModule {}
