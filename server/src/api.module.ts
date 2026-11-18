import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { FilesController } from './admin/files.controller';
import { UsersController } from './admin/users.controller';
import { MeController } from './customer/me.controller';
import { PublicController } from './customer/public.controller';
import { BookingsService } from './domain/bookings.service';
import { StoreService } from './domain/store.service';

/** The REST API used by the admin portal (/admin) and the customer app (/me, /public). */
@Module({
  controllers: [AdminController, UsersController, FilesController, MeController, PublicController],
  providers: [StoreService, BookingsService],
})
export class ApiModule {}
