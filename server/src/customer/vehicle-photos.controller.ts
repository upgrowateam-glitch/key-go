import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Car photos for the apps. Only images that staff attached to a car (vehicle.details.photos) can be fetched here,
 * so other stored files (licences, insurance papers) stay private.
 */
@ApiTags('public')
@Controller('public/vehicles')
export class VehiclePhotosController {
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.root = resolve(config.get<string>('FILE_STORAGE_DIR') || './storage');
  }

  @Get(':id/photos/:fileId')
  @ApiOperation({ summary: 'One photo of a car' })
  async photo(@Param('id') id: string, @Param('fileId') fileId: string, @Res() res: Response) {
    const v = await this.prisma.vehicle.findUnique({ where: { id }, select: { details: true } });
    const photos = ((v?.details as Record<string, unknown> | null)?.photos ?? {}) as Record<string, unknown>;
    if (!Object.values(photos).includes(fileId)) throw new NotFoundException('Photo not found.');
    const file = await this.prisma.storedFile.findUnique({ where: { id: fileId } });
    const full = file && join(this.root, file.path);
    if (!file || !IMAGE_TYPES.includes(file.mimeType) || !full || !existsSync(full)) throw new NotFoundException('Photo not found.');
    res.setHeader('Content-Type', file.mimeType);
    // The file id changes when a photo is replaced, so the image can be cached for a long time
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    createReadStream(full).pipe(res);
  }
}
