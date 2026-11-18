import { BadRequestException, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CurrentUser, StaffOnly, type AuthPayload } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

/** Uploaded documents (vehicle papers and similar). Files are kept on disk under FILE_STORAGE_DIR. */
@ApiTags('admin')
@ApiBearerAuth()
@StaffOnly()
@Controller('admin/files')
export class FilesController {
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.root = resolve(config.get<string>('FILE_STORAGE_DIR') || './storage');
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one file (PDF, JPG, PNG or WebP, up to 10 MB) in the "file" field' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() me: AuthPayload) {
    if (!file) throw new BadRequestException('Attach a file in the "file" field.');
    if (!ALLOWED.includes(file.mimetype)) throw new BadRequestException('Only PDF, JPG, PNG or WebP files are accepted.');
    const id = randomUUID();
    const folder = new Date().toISOString().slice(0, 7);
    mkdirSync(join(this.root, folder), { recursive: true });
    const path = join(folder, id);
    writeFileSync(join(this.root, path), file.buffer);
    const saved = await this.prisma.storedFile.create({
      data: { id, name: file.originalname.slice(0, 200), mimeType: file.mimetype, size: file.size, path, uploadedBy: me.name },
    });
    return { id: saved.id, name: saved.name, type: saved.mimeType, size: saved.size };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a stored file' })
  async remove(@Param('id') id: string) {
    const file = await this.prisma.storedFile.findUnique({ where: { id } });
    if (!file) return;
    await this.prisma.storedFile.delete({ where: { id } });
    rmSync(join(this.root, file.path), { force: true });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download a stored file' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.prisma.storedFile.findUnique({ where: { id } });
    const full = file && join(this.root, file.path);
    if (!file || !full || !existsSync(full)) throw new NotFoundException('File not found.');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    createReadStream(full).pipe(res);
  }
}
