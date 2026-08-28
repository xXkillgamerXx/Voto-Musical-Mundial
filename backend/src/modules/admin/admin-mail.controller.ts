import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MailService } from '../mail/mail.service';
import { SendTestEmailDto } from './dto/send-test-email.dto';

@Controller('admin/mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class AdminMailController {
  constructor(private readonly mail: MailService) {}

  @Get('status')
  status() {
    return this.mail.getPublicStatus();
  }

  @Post('send-test')
  sendTest(@Body() body: SendTestEmailDto) {
    return this.mail.sendTestEmail(body);
  }
}
