import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffOnly } from '../auth/auth.decorators';
import { StorageCleanupService } from '../domain/storage-cleanup.service';

/** Storage housekeeping for the Owner. The clean-up also runs by itself every week. */
@ApiTags('admin')
@ApiBearerAuth()
@StaffOnly('Owner')
@Controller('admin/storage')
export class StorageController {
  constructor(private readonly cleanup: StorageCleanupService) {}

  @Post('cleanup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete uploaded files that nothing uses and that are older than 7 days' })
  run() {
    return this.cleanup.run();
  }
}
