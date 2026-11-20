import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { TraccarService } from './traccar.service';

/** Live car locations for the admin portal (Fleet → GPS, Rental tracking → GPS map). */
@ApiTags('admin')
@ApiBearerAuth()
@Can('tracking', 'view')
@Controller('admin/gps')
export class GpsController {
  constructor(
    private readonly traccar: TraccarService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('positions')
  @ApiOperation({ summary: 'Latest location of every car whose GPS device ID matches a device in Traccar' })
  async positions() {
    if (!this.traccar.configured) return { connected: false, message: 'GPS tracking server is not set up yet.', cars: [], unmatched: [] };
    let positions;
    try {
      positions = await this.traccar.positions();
    } catch (e) {
      return { connected: false, message: (e as Error).message, cars: [], unmatched: [] };
    }
    const vehicles = await this.prisma.vehicle.findMany({ where: { status: { not: 'SOLD' } }, select: { id: true, gpsDeviceId: true } });
    const key = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
    const byDevice = new Map(positions.map((p) => [key(p.deviceId), p]));
    const cars = vehicles.filter((v) => byDevice.has(key(v.gpsDeviceId))).map((v) => ({ vehicleId: v.id, ...byDevice.get(key(v.gpsDeviceId))! }));
    const linked = new Set(vehicles.map((v) => key(v.gpsDeviceId)));
    // Devices sending locations that no car is linked to yet (to help staff fill in the GPS device ID)
    const unmatched = positions.filter((p) => !linked.has(key(p.deviceId))).map((p) => ({ deviceId: p.deviceId, name: p.name, status: p.status, at: p.at }));
    return { connected: true, cars, unmatched };
  }
}
