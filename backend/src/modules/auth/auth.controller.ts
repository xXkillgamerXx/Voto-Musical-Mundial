import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RedisThrottleGuard } from '../../common/throttle.guard';
import { Throttle } from '../../common/throttle.decorator';
import { CurrentUser } from './current-user.decorator';
import { AnonymousTokenDto } from './dto/anonymous-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendEmailVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(RedisThrottleGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ name: 'auth-register', limit: 3, windowSec: 3600 })
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register(dto, request);
  }

  @Post('login')
  @Throttle({ name: 'auth-login', limit: 20, windowSec: 60 })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('verify-email')
  @Throttle({ name: 'auth-verify-email', limit: 20, windowSec: 3600 })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Throttle({ name: 'auth-resend-verification', limit: 8, windowSec: 3600 })
  resendVerification(@Body() dto: ResendEmailVerificationDto) {
    return this.auth.resendEmailVerification(dto);
  }

  @Post('forgot-password')
  @Throttle({ name: 'auth-forgot-password', limit: 8, windowSec: 3600 })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ name: 'auth-reset-password', limit: 10, windowSec: 3600 })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get('reset-password')
  @Throttle({ name: 'auth-reset-password-check', limit: 30, windowSec: 60 })
  checkResetToken(@Query('token') token: string) {
    return this.auth.checkResetToken(token);
  }

  @Post('google')
  @Throttle({ name: 'auth-google', limit: 20, windowSec: 60 })
  google(@Body() dto: GoogleLoginDto, @Req() request: Request) {
    return this.auth.google(dto, request);
  }

  @Post('refresh')
  @Throttle({ name: 'auth-refresh', limit: 60, windowSec: 60 })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto);
  }

  @Post('anonymous')
  @Throttle({ name: 'auth-anonymous', limit: 30, windowSec: 60 })
  anonymous(@Body() dto: AnonymousTokenDto) {
    return this.auth.anonymous(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: unknown) {
    return { user };
  }
}
