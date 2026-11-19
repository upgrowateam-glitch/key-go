import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { StaffOnly } from '../auth/auth.decorators';
import { WhatsAppService } from './whatsapp.service';

class TestMessageDto {
  @IsString()
  @Matches(/^\+?[0-9\s-]{10,16}$/, { message: 'Enter a valid WhatsApp number.' })
  phone: string;
}

/** Linking KeyGo's WhatsApp number (System → WhatsApp & SMS). Owners and Admins only. */
@ApiTags('admin')
@ApiBearerAuth()
@StaffOnly('Owner', 'Admin')
@Controller('admin/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get()
  @ApiOperation({ summary: 'Connection status, linked number and the QR code to scan while linking' })
  status() {
    return this.whatsapp.state();
  }

  @Post('connect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start linking (shows a QR code) or reconnect' })
  connect() {
    return this.whatsapp.connect();
  }

  @Post('disconnect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unlink KeyGo’s WhatsApp number' })
  disconnect() {
    return this.whatsapp.disconnect();
  }

  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a test message' })
  test(@Body() body: TestMessageDto) {
    return this.whatsapp.sendText(body.phone, 'This is a test message from KeyGo. WhatsApp is connected.');
  }
}
