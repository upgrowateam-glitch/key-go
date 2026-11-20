import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Can, CurrentUser, type AuthPayload } from '../auth/auth.decorators';
import { ExtensionsService } from '../domain/extensions.service';
import { actorOf } from '../identity/audit.service';

/** Rental extensions in the admin portal (Bookings area). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/bookings/:id/extensions')
export class ExtensionsController {
  constructor(private readonly extensions: ExtensionsService) {}

  @Get('quote')
  @Can('bookings', 'view')
  @ApiOperation({ summary: 'Price and availability of extending by ?unit=hours|days&amount=n (changes nothing)' })
  quote(@Param('id') id: string, @Query('unit') unit: string, @Query('amount') amount: string) {
    return this.extensions.quote(id, unit, amount);
  }

  @Post()
  @Can('bookings', 'edit')
  @ApiOperation({ summary: 'Extend now: { unit: "hours" | "days", amount } (409 when the car is booked in the extra time)' })
  extend(@Param('id') id: string, @Body() body: { unit?: string; amount?: number }, @CurrentUser() me: AuthPayload) {
    return this.extensions.extendNow(id, body?.unit, body?.amount, actorOf(me));
  }

  @Post(':extensionId/approve')
  @HttpCode(200)
  @Can('bookings', 'edit')
  @ApiOperation({ summary: "Approve a customer's extension request (adds the charges)" })
  approve(@Param('id') id: string, @Param('extensionId') extensionId: string, @CurrentUser() me: AuthPayload) {
    return this.extensions.approve(id, extensionId, actorOf(me));
  }

  @Post(':extensionId/decline')
  @HttpCode(200)
  @Can('bookings', 'edit')
  @ApiOperation({ summary: "Decline a customer's extension request: { reason } (gives the held time back)" })
  decline(@Param('id') id: string, @Param('extensionId') extensionId: string, @Body() body: { reason?: string }, @CurrentUser() me: AuthPayload) {
    return this.extensions.decline(id, extensionId, body?.reason, actorOf(me));
  }
}
