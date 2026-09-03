import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '../../common/throttle.decorator';
import { RedisThrottleGuard } from '../../common/throttle.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FanCheckoutDto } from './dto/checkout.dto';
import { PaypalCaptureDto } from './dto/paypal-capture.dto';
import { FanService } from './fan.service';

@Controller('fan-store')
@UseGuards(RedisThrottleGuard)
export class FanMembershipController {
  constructor(private readonly fan: FanService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: bigint }) {
    return this.fan.getMembershipPayload(user.id);
  }

  @Get('paypal/config')
  paypalConfig() {
    return this.fan.paypalPublicConfig();
  }

  @Post('paypal/order')
  @UseGuards(JwtAuthGuard)
  @Throttle({ name: 'fan-paypal-order', limit: 10, windowSec: 60 })
  createPaypalOrder(@CurrentUser() user: { id: bigint }, @Body() body: FanCheckoutDto) {
    return this.fan.createPaypalOrder(user.id, body);
  }

  @Post('paypal/capture')
  @UseGuards(JwtAuthGuard)
  @Throttle({ name: 'fan-paypal-capture', limit: 20, windowSec: 60 })
  capturePaypal(@CurrentUser() user: { id: bigint }, @Body() body: PaypalCaptureDto) {
    return this.fan.capturePaypalOrder(user.id, body.orderId);
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
