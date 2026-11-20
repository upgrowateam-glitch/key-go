import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Can, CurrentUser, StaffOnly, type AuthPayload } from '../auth/auth.decorators';
import type { Json } from '../domain/mappers';
import { actorOf, AuditService } from '../identity/audit.service';
import { DriverPayService } from './driver-pay.service';

/** Driver pay (Drivers & staff area). Changes are recorded in the audit log. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/payroll/drivers')
export class DriverPayController {
  constructor(
    private readonly pay: DriverPayService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Can('people', 'view')
  @ApiOperation({ summary: 'Every driver\'s pay for a month: salary, trips and commission, advances, deductions, payable' })
  month(@Query('month') month: string) {
    return this.pay.month(month);
  }

  @Get(':driverId/history')
  @Can('people', 'view')
  @ApiOperation({ summary: 'Salary records and the pay audit log of one driver' })
  async history(@Param('driverId') driverId: string) {
    const log = await this.audit.list('driver', driverId);
    return { salaries: await this.pay.salaryHistory(driverId), log: log.filter((e) => e.action.startsWith('pay.')) };
  }

  @Post(':driverId/entries')
  @Can('people', 'edit')
  @ApiOperation({ summary: 'Add an advance, deduction or bonus: { month, type, amount, note, date? }' })
  addEntry(@Param('driverId') driverId: string, @Body() body: Json, @CurrentUser() me: AuthPayload) {
    return this.pay.addEntry(driverId, body ?? {}, actorOf(me));
  }

  @Delete(':driverId/entries/:entryId')
  @HttpCode(204)
  @Can('people', 'edit')
  @ApiOperation({ summary: 'Remove an advance, deduction or bonus (only while the month is open)' })
  async removeEntry(@Param('driverId') driverId: string, @Param('entryId') entryId: string, @CurrentUser() me: AuthPayload) {
    await this.pay.removeEntry(driverId, entryId, actorOf(me));
  }

  @Put(':driverId/salary')
  @Can('people', 'edit')
  @ApiOperation({ summary: 'Set the monthly salary from a month on: { from: "2026-11", amount, note? }' })
  setSalary(@Param('driverId') driverId: string, @Body() body: Json, @CurrentUser() me: AuthPayload) {
    return this.pay.setSalary(driverId, body ?? {}, actorOf(me));
  }

  @Post(':driverId/finalise')
  @Can('people', 'edit')
  @ApiOperation({ summary: 'Freeze the month\'s figures as a payslip' })
  finalise(@Param('driverId') driverId: string, @Body() body: { month?: string }, @CurrentUser() me: AuthPayload) {
    return this.pay.finalise(driverId, body?.month, actorOf(me));
  }

  @Post(':driverId/reopen')
  @StaffOnly('Owner', 'Admin')
  @ApiOperation({ summary: 'Reopen a finalised month that is not paid yet (Owner and Admin)' })
  reopen(@Param('driverId') driverId: string, @Body() body: { month?: string }, @CurrentUser() me: AuthPayload) {
    return this.pay.reopen(driverId, body?.month, actorOf(me));
  }

  @Post(':driverId/paid')
  @Can('people', 'edit')
  @ApiOperation({ summary: 'Record that a finalised month was paid: { month, method, reference }' })
  paid(@Param('driverId') driverId: string, @Body() body: Json, @CurrentUser() me: AuthPayload) {
    return this.pay.markPaid(driverId, body ?? {}, actorOf(me));
  }
}
