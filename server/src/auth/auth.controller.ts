import { Body, Controller, Get, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, StaffOnly, type AuthPayload } from './auth.decorators';
import { LoginDto, RegisterCustomerDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('staff/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin portal sign-in; returns a token and the staff member with their role' })
  staffLogin(@Body() body: LoginDto) {
    return this.auth.staffLogin(body.email, body.password);
  }

  @Get('staff/me')
  @StaffOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in staff member, to restore a session' })
  async staffMe(@CurrentUser() me: AuthPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: me.sub } });
    if (!user) throw new NotFoundException();
    return this.auth.staffSession(user);
  }

  @Post('customer/register')
  @ApiOperation({ summary: 'Create a customer account in the app; returns a token and the profile' })
  register(@Body() body: RegisterCustomerDto) {
    return this.auth.registerCustomer(body);
  }

  @Post('customer/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Customer app sign-in; returns a token and the profile' })
  customerLogin(@Body() body: LoginDto) {
    return this.auth.customerLogin(body.email, body.password);
  }
}
