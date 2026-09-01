import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FanCheckoutDto } from './dto/checkout.dto';
import { FanService } from './fan.service';

@Controller('fan-store')
export class FanMembershipController {
  constructor(private readonly fan: FanService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: bigint }) {
    return this.fan.getMembershipPayload(user.id);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: { id: bigint }, @Body() body: FanCheckoutDto) {
    return this.fan.checkout(user.id, body);
  }

  @Post('purchases/:id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: { id: bigint }, @Param('id') id: string) {
    return this.fan.cancel(user.id, id);
  }
}
