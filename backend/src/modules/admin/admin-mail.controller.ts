import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MailService } from '../mail/mail.service';
import { AdminMailService } from './admin-mail.service';
import {
  PreviewEmailDto,
  SendVerificationTestEmailDto,
  UpdateVerificationCopyDto,
} from './dto/preview-email.dto';
import { SendBulkEmailDto } from './dto/send-bulk-email.dto';
import { SendTestEmailDto } from './dto/send-test-email.dto';

@Controller('admin/mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class AdminMailController {
  constructor(
    private readonly mail: MailService,
    private readonly adminMail: AdminMailService,
  ) {}

  private mapSmtpError(error: unknown): never {
    const message = String((error as Error)?.message || 'No se pudo enviar el correo.');

    if (message.includes('SMTP no configurado')) {
      throw new BadRequestException(
        'SMTP no configurado. Revisa SMTP_HOST, SMTP_USER y SMTP_PASS en backend/.env',
      );
    }

    if (message.includes('Invalid login') || message.includes('BadCredentials')) {
      throw new BadRequestException(
        'SMTP rechazó usuario o contraseña. Si usas BillionMail, SMTP_PASS debe ser la contraseña del buzón noreply@musicmundial.com (Mailboxes), no la de Gmail.',
      );
    }

    if (message.includes('self-signed certificate')) {
      throw new BadRequestException(
        'Error de certificado SMTP interno. Actualiza el backend y reinicia el API.',
      );
    }

    throw new BadRequestException(message);
  }

  @Get('status')
  status() {
    return this.mail.getPublicStatus();
  }

  @Get('metrics')
  metrics() {
    return this.adminMail.getMetrics();
  }

  @Get('users')
  users(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.adminMail.users(search, limit);
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.adminMail.getJob(jobId);
  }

  @Get('templates/verification')
  getVerificationTemplate() {
    return this.adminMail.getVerificationCopy();
  }

  @Put('templates/verification')
  saveVerificationTemplate(@Body() body: UpdateVerificationCopyDto) {
    return this.adminMail.saveVerificationCopy(body);
  }

  @Post('preview')
  async preview(@Body() body: PreviewEmailDto) {
    if (body.mode === 'verification' && !body.copy) {
      const settings = await this.adminMail.getVerificationCopy();
      const locale = body.locale === 'en' ? 'en' : 'es';
      return this.adminMail.preview({
        ...body,
        copy: settings[locale],
      });
    }

    return this.adminMail.preview(body);
  }

  @Post('send')
  sendBulk(@Body() body: SendBulkEmailDto) {
    return this.adminMail.sendBulk(body);
  }

  @Post('send-test')
  async sendTest(@Body() body: SendTestEmailDto) {
    try {
      return await this.mail.sendTestEmail(body);
    } catch (error) {
      this.mapSmtpError(error);
    }
  }

  @Post('send-verification-test')
  async sendVerificationTest(@Body() body: SendVerificationTestEmailDto) {
    try {
      return await this.mail.sendTestVerificationEmail(body);
    } catch (error) {
      this.mapSmtpError(error);
    }
  }
}
