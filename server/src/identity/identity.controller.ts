import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, CustomerOnly, StaffOnly, type AuthPayload } from '../auth/auth.decorators';
import { AREA_LABELS, can, type Access, type Area } from '../auth/permissions';
import { portalBase } from '../common/portal-url';
import { actorOf, AuditService } from './audit.service';
import { isOwnerType, type OwnerType } from './identity-kinds';
import { IdentityLinksService } from './identity-links.service';
import { IdentityService, MAX_IDENTITY_BYTES } from './identity.service';

function ensure(me: AuthPayload, area: Area, access: Exclude<Access, 'none'>) {
  if (!can(me.role, area, access)) throw new ForbiddenException(`Your ${me.role} account cannot ${access === 'edit' ? 'change' : 'open'} ${AREA_LABELS[area]}.`);
}

/** Customers' documents belong to Customers, drivers' documents to Drivers & staff. */
const ownerArea = (ownerType: OwnerType): Area => (ownerType === 'customer' ? 'customers' : 'people');

function owner(type: string): OwnerType {
  if (!isOwnerType(type)) throw new BadRequestException('Unknown kind of person.');
  return type;
}

/**
 * Identity documents in the admin portal.
 * - Uploading: anyone who may edit the customer (or driver).
 * - Opening a document, verifying/rejecting it and the face check: "ID documents & face check" access
 *   (Owner, Admin and Manager by default). Every opening is written to the audit log.
 */
@ApiTags('admin')
@ApiBearerAuth()
@StaffOnly()
@Controller('admin/identity')
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly links: IdentityLinksService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Get('encryption')
  @StaffOnly('Owner', 'Admin')
  @ApiOperation({ summary: 'Whether the server has the encryption key the stored identity data needs' })
  encryption() {
    return this.identity.keyStatus();
  }

  @Get('documents/:id/file')
  @ApiOperation({ summary: 'Open one identity document (decrypted; recorded in the audit log)' })
  async file(@Param('id') id: string, @CurrentUser() me: AuthPayload, @Res() res: Response) {
    ensure(me, 'identity', 'view');
    const f = await this.identity.open(id, actorOf(me));
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.name)}"`);
    res.end(f.content);
  }

  @Post('documents/:id/review')
  @ApiOperation({ summary: 'Verify or reject a document; a rejection needs a reason' })
  review(@Param('id') id: string, @Body() body: { status?: string; reason?: string }, @CurrentUser() me: AuthPayload) {
    ensure(me, 'identity', 'edit');
    if (body?.status !== 'Verified' && body?.status !== 'Rejected') throw new BadRequestException('Status must be Verified or Rejected.');
    return this.identity.review(id, body.status, typeof body.reason === 'string' ? body.reason : undefined, actorOf(me));
  }

  @Delete('documents/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a document' })
  async remove(@Param('id') id: string, @CurrentUser() me: AuthPayload) {
    ensure(me, 'identity', 'edit');
    await this.identity.remove(id, actorOf(me));
  }

  @Post('customer/:id/face-check')
  @ApiOperation({ summary: 'Record the face check: the photo or selfie matches the ID card photo, or not' })
  faceCheck(@Param('id') id: string, @Body() body: { result?: string; note?: string }, @CurrentUser() me: AuthPayload) {
    ensure(me, 'identity', 'edit');
    if (body?.result !== 'match' && body?.result !== 'no_match') throw new BadRequestException('Result must be match or no_match.');
    return this.identity.faceCheck(id, body.result, typeof body.note === 'string' ? body.note : undefined, actorOf(me));
  }

  @Get(':ownerType/:ownerId')
  @ApiOperation({ summary: 'Documents on file for a customer or driver (no files), and what the caller may do' })
  async list(@Param('ownerType') type: string, @Param('ownerId') ownerId: string, @CurrentUser() me: AuthPayload) {
    const ownerType = owner(type);
    ensure(me, ownerArea(ownerType), 'view');
    return {
      documents: await this.identity.list(ownerType, ownerId),
      canUpload: can(me.role, ownerArea(ownerType), 'edit'),
      canOpen: can(me.role, 'identity', 'view'),
      canReview: can(me.role, 'identity', 'edit'),
    };
  }

  @Get(':ownerType/:ownerId/history')
  @ApiOperation({ summary: 'Audit log for a customer or driver: uploads, reviews, face checks, who opened what' })
  history(@Param('ownerType') type: string, @Param('ownerId') ownerId: string, @CurrentUser() me: AuthPayload) {
    owner(type);
    ensure(me, 'identity', 'view');
    return this.audit.list(type, ownerId);
  }

  @Post(':ownerType/:ownerId/documents/:kind')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document (JPG, PNG, WebP or PDF up to 10 MB); it is encrypted before it is stored' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IDENTITY_BYTES } }))
  upload(
    @Param('ownerType') type: string,
    @Param('ownerId') ownerId: string,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() me: AuthPayload,
  ) {
    const ownerType = owner(type);
    ensure(me, ownerArea(ownerType), 'edit');
    return this.identity.upload(ownerType, ownerId, kind, file, actorOf(me), 'staff');
  }

  @Post(':ownerType/:ownerId/link')
  @ApiOperation({ summary: 'A 30-minute upload page for a phone (shown as a QR code)' })
  async link(@Param('ownerType') type: string, @Param('ownerId') ownerId: string, @Body() body: { baseUrl?: string }, @CurrentUser() me: AuthPayload) {
    const ownerType = owner(type);
    ensure(me, ownerArea(ownerType), 'edit');
    const link = await this.links.create(ownerType, ownerId, 'staff-phone', actorOf(me));
    return { ...link, url: `${portalBase(this.config.get('CORS_ORIGINS'), body?.baseUrl)}/verify?token=${encodeURIComponent(link.token)}` };
  }

  @Delete(':ownerType/:ownerId/link')
  @HttpCode(204)
  @ApiOperation({ summary: 'Close the phone upload page' })
  closeLink(@Param('ownerType') type: string, @Param('ownerId') ownerId: string, @CurrentUser() me: AuthPayload) {
    const ownerType = owner(type);
    ensure(me, ownerArea(ownerType), 'edit');
    this.links.close(ownerType, ownerId);
  }
}

/** The phone page opened from a QR code or from the app. The token in the address is the only permission. */
@ApiTags('public')
@Controller('public/id-links/:token')
export class PublicIdentityLinksController {
  constructor(private readonly links: IdentityLinksService) {}

  @Get()
  @ApiOperation({ summary: 'Which documents the link can add, and which are already on file' })
  describe(@Param('token') token: string) {
    return this.links.describe(token);
  }

  @Post('documents/:kind')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add one document through the link' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IDENTITY_BYTES } }))
  upload(@Param('token') token: string, @Param('kind') kind: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.links.upload(token, kind, file);
  }
}

/** Customers upload their own documents on a secure web page opened from the app. */
@ApiTags('customer')
@ApiBearerAuth()
@CustomerOnly()
@Controller('me')
export class CustomerDocumentsController {
  constructor(
    private readonly links: IdentityLinksService,
    private readonly config: ConfigService,
  ) {}

  @Post('document-link')
  @ApiOperation({ summary: 'A 30-minute page for uploading your ID, licence and selfie' })
  async link(@CurrentUser() me: AuthPayload) {
    const link = await this.links.create('customer', me.sub, 'customer-link', actorOf(me));
    return { url: `${portalBase(this.config.get('CORS_ORIGINS'))}/verify?token=${encodeURIComponent(link.token)}`, expiresAt: link.expiresAt };
  }
}
