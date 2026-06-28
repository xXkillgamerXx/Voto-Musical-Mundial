import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RedisThrottleGuard } from '../../common/throttle.guard';
import { Throttle } from '../../common/throttle.decorator';
import { CurrentUser } from './current-user.decorator';
import { AnonymousTokenDto } from './dto/anonymous-token.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(RedisThrottleGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ name: 'auth-register', limit: 10, windowSec: 3600 })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @Throttle({ name: 'auth-login', limit: 20, windowSec: 60 })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('google')
  @Throttle({ name: 'auth-google', limit: 20, windowSec: 60 })
  google(@Body() dto: GoogleLoginDto) {
    return this.auth.google(dto);
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
