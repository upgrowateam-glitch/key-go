import { Body, Controller, Get, HttpCode, NotFoundException, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, SignedIn, StaffOnly, type AuthPayload } from './auth.decorators';
import { ChangePasswordDto, LoginDto, RegisterCustomerDto } from './auth.dto';
import { AuthService } from './auth.service';
import { AREA_LABELS, AREAS, ROLE_PERMISSIONS } from './permissions';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('staff/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin portal sign-in; returns a token and the staff member with their role and permissions' })
  staffLogin(@Body() body: LoginDto, @Req() req: Request) {
    return this.auth.staffLogin(body.email, body.password, req.ip);
  }

  @Get('staff/me')
  @StaffOnly('Owner', 'Admin', 'Manager', 'Staff', 'Driver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in staff member with their permissions, to restore a session' })
  async staffMe(@CurrentUser() me: AuthPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: me.sub } });
    if (!user) throw new NotFoundException();
    return this.auth.staffSession(user);
  }

  @Get('permissions')
  @StaffOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'What every role can view or change, for the Settings → Permissions page' })
  permissions() {
    return { areas: AREAS.map((id) => ({ id, label: AREA_LABELS[id] })), roles: ROLE_PERMISSIONS };
  }

  @Post('customer/register')
  @ApiOperation({ summary: 'Create a customer account in the app; returns a token and the profile' })
  register(@Body() body: RegisterCustomerDto) {
    return this.auth.registerCustomer(body);
  }

  @Post('customer/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Customer app sign-in; returns a token and the profile' })
  customerLogin(@Body() body: LoginDto, @Req() req: Request) {
    return this.auth.customerLogin(body.email, body.password, req.ip);
  }

  @Post('password')
  @HttpCode(200)
  @SignedIn()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change your own password (staff or customer); other devices are signed out' })
  changePassword(@CurrentUser() me: AuthPayload, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(me, body.currentPassword, body.newPassword);
  }

  @Post('sign-out-everywhere')
  @HttpCode(204)
  @SignedIn()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out of KeyGo on every device, including this one' })
  async signOutEverywhere(@CurrentUser() me: AuthPayload) {
    await this.auth.signOutEverywhere(me);
  }
}
