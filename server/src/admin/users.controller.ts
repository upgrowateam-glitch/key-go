import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { hash } from 'bcryptjs';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, StaffOnly, type AuthPayload } from '../auth/auth.decorators';
import { roleEnum, type StaffRoleLabel } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';

const ROLES: StaffRoleLabel[] = ['Owner', 'Admin', 'Manager', 'Staff'];

class CreateUserDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsEmail({}, { message: 'Enter a valid email address.' }) email: string;
  @IsIn(ROLES) role: StaffRoleLabel;
  @IsOptional() @IsString() @MaxLength(80) branch?: string;
  @IsString() @MinLength(8, { message: 'Use at least 8 characters for the password.' }) password: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsIn(ROLES) role?: StaffRoleLabel;
  @IsOptional() @IsString() @MaxLength(80) branch?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(8, { message: 'Use at least 8 characters for the password.' }) password?: string;
}

const lastActive = (d: Date | null) => {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};

const toApi = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: roleEnum.fromDb(u.role),
  branch: u.branchName ?? '',
  active: u.active,
  lastActive: lastActive(u.lastLoginAt),
});

/** Staff accounts that can sign in to the admin portal. Owners and Admins manage them; only Owners manage Owners. */
@ApiTags('admin')
@ApiBearerAuth()
@StaffOnly('Owner', 'Admin')
@Controller('admin/users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'All staff accounts' })
  async list() {
    return (await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map(toApi);
  }

  @Post()
  @ApiOperation({ summary: 'Create a staff account with a starting password' })
  async create(@Body() body: CreateUserDto, @CurrentUser() me: AuthPayload) {
    if (body.role === 'Owner' && me.role !== 'Owner') throw new ForbiddenException('Only an Owner can create another Owner.');
    const email = body.email.trim().toLowerCase();
    if (await this.prisma.user.count({ where: { email } })) throw new ConflictException('A staff account with this email already exists.');
    const user = await this.prisma.user.create({
      data: { name: body.name.trim(), email, role: roleEnum.toDb(body.role), branchName: body.branch?.trim() || null, passwordHash: await hash(body.password, 10) },
    });
    return toApi(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change name, role, branch, active state or password' })
  async update(@Param('id') id: string, @Body() body: UpdateUserDto, @CurrentUser() me: AuthPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Staff account not found.');
    const touchesOwner = user.role === 'OWNER' || body.role === 'Owner';
    if (touchesOwner && me.role !== 'Owner') throw new ForbiddenException('Only an Owner can change an Owner account.');

    const losesOwner = user.role === 'OWNER' && user.active && (body.active === false || (body.role !== undefined && body.role !== 'Owner'));
    if (losesOwner && (await this.prisma.user.count({ where: { role: 'OWNER', active: true } })) <= 1) {
      throw new BadRequestException('KeyGo needs at least one active Owner account.');
    }
    if (id === me.sub && body.active === false) throw new BadRequestException('You cannot deactivate your own account.');

    const saved = await this.prisma.user.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        role: body.role ? roleEnum.toDb(body.role) : undefined,
        branchName: body.branch === undefined ? undefined : body.branch.trim() || null,
        active: body.active,
        passwordHash: body.password ? await hash(body.password, 10) : undefined,
      },
    });
    return toApi(saved);
  }
}
