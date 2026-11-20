import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { FilesController } from './admin/files.controller';
import { PhotoLinksService, PublicPhotoLinksController, VehiclePhotoLinksController } from './admin/vehicle-photo-links';
import { UsersController } from './admin/users.controller';
import { DriverController } from './admin/driver.controller';
import { WhatsAppController } from './whatsapp/whatsapp.controller';
import { GpsController } from './gps/gps.controller';
import { TraccarService } from './gps/traccar.service';
import { VehiclePhotosController } from './customer/vehicle-photos.controller';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { MeController } from './customer/me.controller';
import { PublicController } from './customer/public.controller';
import { BookingsService } from './domain/bookings.service';
import { StoreService } from './domain/store.service';
import { StaffSyncService } from './domain/staff-sync.service';

/** The REST API used by the admin portal (/admin) and the customer app (/me, /public). */
@Module({
  controllers: [AdminController, UsersController, FilesController, DriverController, WhatsAppController, GpsController, MeController, PublicController, VehiclePhotosController, VehiclePhotoLinksController, PublicPhotoLinksController],
  providers: [StoreService, BookingsService, WhatsAppService, StaffSyncService, TraccarService, PhotoLinksService],
})
export class ApiModule {}
