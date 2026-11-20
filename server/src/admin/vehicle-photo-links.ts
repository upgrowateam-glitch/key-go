import {
  BadRequestException,
  Controller,
  Delete,
  GoneException,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Can, CurrentUser, type AuthPayload } from '../auth/auth.decorators';
import { PHOTO_SLOTS, type PhotoSlot } from '../domain/vehicle-rules';
import { PrismaService } from '../prisma/prisma.service';

const LINK_MINUTES = 30;
const MAX_UPLOADS_PER_LINK = 60;
const MAX_BYTES = 10 * 1024 * 1024;
const SLOT_LABELS: Record<PhotoSlot, string> = {
  main: 'Main photo',
  front: 'Front',
  back: 'Back',
  left: 'Left side',
  right: 'Right side',
  interior: 'Interior',
  dashboard: 'Dashboard',
};

type Json = Record<string, unknown>;
interface PhotoLink {
  vehicleId: string;
  expiresAt: number;
  createdBy: string;
  uploads: number;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const asObject = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const photosOf = (details: Json) => asObject(details.photos) as Record<string, string>;

/** What a file really is, from its first bytes (the browser's stated type is not trusted). */
function imageType(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Short-lived "take photos with your phone" links. Staff open a QR code on the computer; scanning it opens a page
 * on the phone that can upload photos to that one car only, for 30 minutes or until staff close it. Only a hash
 * of the token is kept, in memory: a server restart simply ends open links (staff show a new QR code).
 */
@Injectable()
export class PhotoLinksService {
  private readonly links = new Map<string, PhotoLink>();
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.root = resolve(config.get<string>('FILE_STORAGE_DIR') || './storage');
  }

  private sweep() {
    const now = Date.now();
    for (const [k, l] of this.links) if (l.expiresAt <= now) this.links.delete(k);
  }

  private async vehicle(id: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id }, select: { id: true, name: true, registrationNo: true, details: true } });
    if (!v) throw new NotFoundException('Vehicle not found.');
    return v;
  }

  async create(vehicleId: string, by: string) {
    await this.vehicle(vehicleId);
    this.sweep();
    // One open link per car: a new QR code replaces the old one
    for (const [k, l] of this.links) if (l.vehicleId === vehicleId) this.links.delete(k);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + LINK_MINUTES * 60_000;
    this.links.set(hash(token), { vehicleId, expiresAt, createdBy: by, uploads: 0 });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  close(vehicleId: string) {
    for (const [k, l] of this.links) if (l.vehicleId === vehicleId) this.links.delete(k);
  }

  isOpen(vehicleId: string) {
    this.sweep();
    return [...this.links.values()].some((l) => l.vehicleId === vehicleId);
  }

  link(token: string) {
    this.sweep();
    const l = this.links.get(hash(token));
    if (!l) throw new GoneException('This photo link has expired or was closed. Show a new QR code on the computer.');
    return l;
  }

  async describe(token: string) {
    const l = this.link(token);
    const v = await this.vehicle(l.vehicleId);
    const details = asObject(v.details);
    const photos = photosOf(details);
    return {
      vehicleId: v.id,
      name: v.name,
      code: typeof details.code === 'string' ? details.code : undefined,
      vehicleNumber: v.registrationNo,
      expiresAt: new Date(l.expiresAt).toISOString(),
      slots: PHOTO_SLOTS.map((slot) => ({ slot, label: SLOT_LABELS[slot], fileId: photos[slot] ?? null })),
    };
  }

  /** Stores the photo and puts it in the car's slot (replacing and deleting any photo that was there). */
  async upload(token: string, slot: string, file: Express.Multer.File | undefined) {
    const l = this.link(token);
    if (!(PHOTO_SLOTS as readonly string[]).includes(slot)) throw new BadRequestException('Unknown photo position.');
    if (!file) throw new BadRequestException('Attach a photo in the "file" field.');
    const type = imageType(file.buffer);
    if (!type) throw new BadRequestException('Only JPG, PNG or WebP photos are accepted.');
    if (l.uploads >= MAX_UPLOADS_PER_LINK) throw new BadRequestException('This link has been used for many photos. Show a new QR code on the computer.');
    l.uploads++;

    const id = randomUUID();
    const folder = new Date().toISOString().slice(0, 7);
    mkdirSync(join(this.root, folder), { recursive: true });
    const path = join(folder, id);
    writeFileSync(join(this.root, path), file.buffer);
    await this.prisma.storedFile.create({
      data: { id, name: `${slot}.${type.split('/')[1]}`, mimeType: type, size: file.size, path, uploadedBy: `${l.createdBy} (phone)` },
    });

    // Read-modify-write inside a transaction so two quick uploads from the phone don't overwrite each other
    const old = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ details: unknown }[]>`SELECT details FROM vehicles WHERE id = ${l.vehicleId} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Vehicle not found.');
      const details = asObject(rows[0].details);
      const photos = photosOf(details);
      const previous = photos[slot];
      const next = { ...photos, [slot]: id };
      const mainPhoto = next.main ? 'main' : typeof details.mainPhoto === 'string' && next[details.mainPhoto] ? details.mainPhoto : next.front ? 'front' : slot;
      await tx.vehicle.update({ where: { id: l.vehicleId }, data: { details: { ...details, photos: next, mainPhoto } as object } });
      return previous;
    });
    if (old && old !== id) {
      const f = await this.prisma.storedFile.findUnique({ where: { id: old } });
      if (f) {
        await this.prisma.storedFile.delete({ where: { id: old } });
        rmSync(join(this.root, f.path), { force: true });
      }
    }
    return { slot, label: SLOT_LABELS[slot as PhotoSlot], fileId: id };
  }

  /** The car's current photos, for the computer screen to pick up phone uploads. */
  async photos(vehicleId: string) {
    const v = await this.vehicle(vehicleId);
    const details = asObject(v.details);
    return { open: this.isOpen(vehicleId), photos: photosOf(details), mainPhoto: typeof details.mainPhoto === 'string' ? details.mainPhoto : undefined };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/vehicles/:id/photo-link')
export class VehiclePhotoLinksController {
  constructor(private readonly links: PhotoLinksService) {}

  @Post()
  @Can('fleet', 'edit')
  @ApiOperation({ summary: 'Open a 30-minute link (QR code) for uploading this car\'s photos from a phone' })
  create(@Param('id') id: string, @CurrentUser() me: AuthPayload) {
    return this.links.create(id, me.name);
  }

  @Get()
  @Can('fleet', 'edit')
  @ApiOperation({ summary: 'Whether the phone link is still open, and the car\'s photos right now' })
  status(@Param('id') id: string) {
    return this.links.photos(id);
  }

  @Delete()
  @HttpCode(204)
  @Can('fleet', 'edit')
  @ApiOperation({ summary: 'Close the phone link' })
  close(@Param('id') id: string) {
    this.links.close(id);
  }
}

/** Used by the phone page opened from the QR code; the token in the address is the only permission. */
@ApiTags('public')
@Controller('public/photo-links/:token')
export class PublicPhotoLinksController {
  constructor(private readonly links: PhotoLinksService) {}

  @Get()
  @ApiOperation({ summary: 'The car and its photo positions for a phone link' })
  describe(@Param('token') token: string) {
    return this.links.describe(token);
  }

  @Post('photos/:slot')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one photo (JPG, PNG or WebP up to 10 MB) for a position of the car' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  upload(@Param('token') token: string, @Param('slot') slot: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.links.upload(token, slot, file);
  }
}
