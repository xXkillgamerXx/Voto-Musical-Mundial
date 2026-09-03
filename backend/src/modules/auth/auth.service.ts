import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuth2Client, TokenInfo } from 'google-auth-library';
import { Request } from 'express';
import { BLOCKED_IPS_KEY } from '../../common/moderation-keys';
import { getClientIp, hashIp } from '../../common/request';
import { LifecycleNotifyService } from '../admin/lifecycle-notify.service';
import { ModerationService } from '../admin/moderation.service';
import { MailService } from '../mail/mail.service';
import { MissionProgressService } from '../missions/mission-progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnonymousTokenDto } from './dto/anonymous-token.dto';
import { AppleLoginDto } from './dto/apple-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendEmailVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { JwtPayload, VoteIdentity } from './auth.types';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));
const DEFAULT_APPLE_CLIENT_ID = 'vote.musicmundial.com';

const REFERRAL_SIGNUP_POINTS = 50;
const REFERRAL_MILESTONE_BONUSES: Record<number, number> = {
  5: 300,
  10: 700,
};
const DEFAULT_SIGNUP_MAX_PER_IP = 3;
const EMAIL_VERIFY_TTL_SECONDS = 15 * 60;
const EMAIL_VERIFY_CODE_LENGTH = 6;

const usernameFromEmail = (email: string) =>
  email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'google_user';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly missionProgress: MissionProgressService,
    @Inject(forwardRef(() => LifecycleNotifyService))
    private readonly lifecycleNotify: LifecycleNotifyService,
    @Inject(forwardRef(() => ModerationService))
    private readonly moderation: ModerationService,
  ) {}

  async register(dto: RegisterDto, request?: Request) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedUsername = dto.username.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const referrer = await this.findReferrer(dto.referralCode);
    const signupIpHash = this.resolveSignupIpHash(request);
    let signupSlotReserved = false;

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
    });

    if (existing?.email === normalizedEmail) {
      throw new ConflictException('Ese correo ya esta registrado.');
    }

    if (existing?.username === normalizedUsername) {
      throw new ConflictException('Ese username ya esta en uso.');
    }

    if (signupIpHash) {
      await this.reserveSignupSlot(signupIpHash);
      signupSlotReserved = true;
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          username: normalizedUsername,
          displayName: dto.displayName || normalizedUsername,
          passwordHash,
          referralCode: normalizedUsername,
          referredById: referrer?.userId || null,
          points: 25,
          metadata: {
            ...(dto.metadata && typeof dto.metadata === 'object' ? dto.metadata : {}),
            locale: dto.locale === 'es' ? 'es' : 'en',
            ...(signupIpHash ? { signupIpHash } : {}),
          } as Prisma.InputJsonValue,
        },
      });

      await tx.referralCode.upsert({
        where: { code: normalizedUsername },
        update: { userId: created.id, username: normalizedUsername },
        create: {
          code: normalizedUsername,
          userId: created.id,
          username: normalizedUsername,
        },
      });

      let createdUser = created;

      if (referrer && referrer.userId !== created.id) {
        const referrerUser = await tx.user.findUnique({ where: { id: referrer.userId } });
        const nextSignupCount = Number(referrerUser?.referralSignups || 0) + 1;
        const milestoneBonus = REFERRAL_MILESTONE_BONUSES[nextSignupCount] || 0;
        const pointsAwarded = REFERRAL_SIGNUP_POINTS + milestoneBonus;

        const referralSignup = await tx.referralSignup.create({
          data: {
            userId: created.id,
            referrerId: referrer.userId,
            referralCode: referrer.code,
            pointsAwarded,
            signupPoints: REFERRAL_SIGNUP_POINTS,
            milestoneBonus,
            milestone: milestoneBonus ? nextSignupCount : null,
          },
        });
        await tx.user.update({
          where: { id: referrer.userId },
          data: {
            points: { increment: pointsAwarded },
            referralPoints: { increment: pointsAwarded },
            referralSignups: { increment: 1 },
          },
        });
        createdUser = await this.applyReferralSignupBonus(tx, created, referralSignup.id);
        await this.applyReferralSignupMissions(tx, referrer.userId);
      }

      return createdUser;
    }).catch((error) => {
      if (signupSlotReserved && signupIpHash) {
        void this.releaseSignupSlot(signupIpHash).catch(() => {});
      }

      if (error?.code === 'P2002') {
        throw new ConflictException('Ese correo o username ya esta registrado.');
      }

      if (error?.code === 'P2021' || error?.code === 'P2022') {
        throw new BadRequestException('La base PostgreSQL no tiene las tablas actualizadas. Ejecuta las migraciones de Prisma.');
      }

      throw error;
    });

    const locale = dto.locale === 'es' ? 'es' : 'en';
    await this.issueEmailVerificationCode(user, locale);
    void this.maybeAlertSpawnSignup(user, signupIpHash).catch(() => {});

    return {
      requiresEmailVerification: true as const,
      email: user.email,
      message: 'Te enviamos un codigo a tu correo para activar la cuenta.',
    };
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    if (!user.emailVerifiedAt) {
      if (user.email) {
        void this.issueEmailVerificationCode(user, this.resolveUserLocale(user.metadata)).catch((error) => {
          this.logger.warn(
            `No se pudo reenviar codigo al login de ${user.email}: ${(error as Error).message}`,
          );
        });
      }
      throw new HttpException(
        {
          statusCode: 403,
          error: 'EMAIL_NOT_VERIFIED',
          message: 'Debes verificar tu correo antes de entrar. Te enviamos un codigo nuevo.',
          email: user.email,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return this.authResponse(user);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.toLowerCase().trim();
    const code = String(dto.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('El codigo debe tener 6 digitos.');
    }

    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user) {
      throw new BadRequestException('Codigo incorrecto o vencido.');
    }

    if (user.emailVerifiedAt) {
      return this.authResponse(user);
    }

    const codeHash = this.hashEmailVerificationCode(code);
    const storedUserId = await this.redis.client.get(this.emailVerifyCodeKey(codeHash));
    const expectedHash = await this.redis.client.get(this.emailVerifyUserKey(user.id));

    if (!storedUserId || storedUserId !== user.id.toString() || expectedHash !== codeHash) {
      throw new BadRequestException('Codigo incorrecto o vencido.');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });

    await this.clearEmailVerificationKeys(user.id, codeHash);
    this.lifecycleNotify.notifyWelcomeAsync(updated);

    return this.authResponse(updated);
  }

  async resendEmailVerification(dto: ResendEmailVerificationDto) {
    const email = dto.email.toLowerCase().trim();
    const generic = {
      ok: true as const,
      message: 'Si la cuenta existe y no esta verificada, enviamos un codigo nuevo.',
    };
    const user = await this.prisma.user.findFirst({ where: { email } });

    if (!user?.email || user.emailVerifiedAt) {
      return generic;
    }

    const locale = dto.locale === 'es' ? 'es' : 'en';
    try {
      await this.issueEmailVerificationCode(user, locale);
    } catch (error) {
      this.logger.error(`No se pudo reenviar verificacion a ${email}: ${(error as Error).message}`);
      if (this.config.get('NODE_ENV') !== 'production') {
        throw new ServiceUnavailableException(`No se pudo enviar el correo: ${(error as Error).message}`);
      }
    }

    return generic;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const generic = { ok: true as const };
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, displayName: true, username: true },
    });

    if (!user?.email) {
      return generic;
    }

    if (!this.mail.isConfigured()) {
      if (this.config.get('NODE_ENV') !== 'production') {
        throw new ServiceUnavailableException(
          'Falta configurar SMTP_HOST / SMTP_USER / SMTP_PASS en backend/.env para enviar el correo.',
        );
      }
      this.logger.warn('forgot-password: SMTP no configurado');
      return generic;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const tokenKey = `password-reset:${tokenHash}`;
    const userKey = `password-reset-user:${user.id.toString()}`;
    const previousHash = await this.redis.client.get(userKey);
    if (previousHash) {
      await this.redis.client.del(`password-reset:${previousHash}`);
    }
    await this.redis.client.set(tokenKey, user.id.toString(), 'EX', 60 * 60);
    await this.redis.client.set(userKey, tokenHash, 'EX', 60 * 60);

    const origin = String(this.config.get('APP_ORIGIN') || 'http://localhost:5173')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    const locale = dto.locale === 'es' ? 'es' : 'en';
    const resetPath = locale === 'en' ? '/reset-password' : '/recuperar-contrasena';
    const resetUrl = `${origin}${resetPath}?token=${token}`;

    try {
      await this.mail.sendPasswordReset({
        to: user.email,
        name: user.displayName || user.username || '',
        resetUrl,
        locale,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar reset a ${user.email}: ${(error as Error).message}`);
      if (this.config.get('NODE_ENV') !== 'production') {
        throw new ServiceUnavailableException(`No se pudo enviar el correo: ${(error as Error).message}`);
      }
    }

    return generic;
  }

  async checkResetToken(token: string) {
    const value = String(token || '').trim();
    if (!/^[a-f0-9]{64}$/.test(value)) {
      return { valid: false };
    }

    const tokenHash = createHash('sha256').update(value).digest('hex');
    const userId = await this.redis.client.get(`password-reset:${tokenHash}`);
    return { valid: Boolean(userId) };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token.trim()).digest('hex');
    const userId = await this.redis.client.get(`password-reset:${tokenHash}`);
    if (!userId) {
      throw new BadRequestException('El enlace no es valido o ya vencio. Pide uno nuevo.');
    }

    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { passwordHash: await bcrypt.hash(dto.password, 12) },
    });
    await this.redis.client.del(`password-reset:${tokenHash}`);
    await this.redis.client.del(`password-reset-user:${userId}`);

    return { ok: true as const };
  }

  async google(dto: GoogleLoginDto, request?: Request) {
    try {
      return await this.googleUnsafe(dto, request);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = (error as Error)?.message || 'error desconocido';
      this.logger.error(`Google login fallo: ${message}`, (error as Error)?.stack);
      if (this.config.get('NODE_ENV') !== 'production') {
        throw new BadRequestException(`No se pudo completar el inicio con Google: ${message}`);
      }
      throw new UnauthorizedException('No se pudo completar el inicio con Google.');
    }
  }

  private async googleUnsafe(dto: GoogleLoginDto, request?: Request) {
    const locale = dto.locale === 'es' ? 'es' : 'en';
    const clientId = String(this.config.get<string>('GOOGLE_CLIENT_ID') || '').trim();
    if (!clientId) {
      throw new BadRequestException('Falta configurar GOOGLE_CLIENT_ID.');
    }

    const client = new OAuth2Client(clientId);
    const payload = dto.credential
      ? await this.googlePayloadFromCredential(client, clientId, dto.credential)
      : await this.googlePayloadFromAccessToken(client, clientId, dto.accessToken || '');
    const email = String(payload?.email || '').toLowerCase().trim();
    const referrer = await this.findReferrer(dto.referralCode);
    const rawVerified = (payload as { email_verified?: unknown })?.email_verified;
    const emailVerified =
      rawVerified === true || rawVerified === 'true' || rawVerified === '1';

    if (!payload?.sub || !email || !emailVerified) {
      throw new UnauthorizedException('No se pudo validar la cuenta de Google.');
    }

    const existingByEmail = await this.prisma.user.findFirst({ where: { email } });
    const existingBySub = await this.prisma.user.findFirst({
      where: { metadata: { path: ['googleSub'], equals: payload.sub } },
    });
    const existing = existingBySub || existingByEmail;

    if (existing) {
      const emailTaken =
        existing.email !== email
          ? await this.prisma.user.findFirst({
              where: { email, id: { not: existing.id } },
              select: { id: true },
            })
          : null;

      const wasUnverified = !existing.emailVerifiedAt;
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          email: emailTaken ? existing.email : email,
          displayName: existing.displayName || payload.name || usernameFromEmail(email),
          photoUrl: payload.picture || existing.photoUrl,
          emailVerifiedAt: existing.emailVerifiedAt || new Date(),
          metadata: {
            ...((existing.metadata as Record<string, unknown>) || {}),
            googleSub: payload.sub,
            googleEmail: email,
            googlePicture: payload.picture || null,
            authProvider: 'google',
            ...(!((existing.metadata as Record<string, unknown>) || {}).locale
              ? { locale }
              : {}),
          } as any,
        },
      });

      if (wasUnverified) {
        this.lifecycleNotify.notifyWelcomeAsync(updated);
      }

      return this.authResponse(updated);
    }

    const baseUsername = usernameFromEmail(email);
    const username = await this.availableUsername(baseUsername, payload.sub.slice(-6));
    const signupIpHash = this.resolveSignupIpHash(request);
    let signupSlotReserved = false;

    if (signupIpHash) {
      await this.reserveSignupSlot(signupIpHash);
      signupSlotReserved = true;
    }

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username,
          displayName: payload.name || username,
          photoUrl: payload.picture || null,
          referralCode: username,
          referredById: referrer?.userId || null,
          points: 25,
          emailVerifiedAt: new Date(),
          metadata: {
            googleSub: payload.sub,
            googleEmail: email,
            googlePicture: payload.picture || null,
            authProvider: 'google',
            locale,
            ...(signupIpHash ? { signupIpHash } : {}),
          } as Prisma.InputJsonValue,
        },
      });
      await tx.referralCode.create({
        data: {
          code: username,
          userId: created.id,
          username,
        },
      });

      let createdUser = created;

      if (referrer && referrer.userId !== created.id) {
        const referrerUser = await tx.user.findUnique({ where: { id: referrer.userId } });
        const nextSignupCount = Number(referrerUser?.referralSignups || 0) + 1;
        const milestoneBonus = REFERRAL_MILESTONE_BONUSES[nextSignupCount] || 0;
        const pointsAwarded = REFERRAL_SIGNUP_POINTS + milestoneBonus;

        const referralSignup = await tx.referralSignup.create({
          data: {
            userId: created.id,
            referrerId: referrer.userId,
            referralCode: referrer.code,
            pointsAwarded,
            signupPoints: REFERRAL_SIGNUP_POINTS,
            milestoneBonus,
            milestone: milestoneBonus ? nextSignupCount : null,
          },
        });
        await tx.user.update({
          where: { id: referrer.userId },
          data: {
            points: { increment: pointsAwarded },
            referralPoints: { increment: pointsAwarded },
            referralSignups: { increment: 1 },
          },
        });
        createdUser = await this.applyReferralSignupBonus(tx, created, referralSignup.id);
        await this.applyReferralSignupMissions(tx, referrer.userId);
      }

      return createdUser;
    });
    } catch (error) {
      if (signupSlotReserved && signupIpHash) {
        void this.releaseSignupSlot(signupIpHash).catch(() => {});
      }
      throw error;
    }

    this.lifecycleNotify.notifyWelcomeAsync(user);
    void this.maybeAlertSpawnSignup(user, signupIpHash).catch(() => {});
    return this.authResponse(user);
  }

  async apple(dto: AppleLoginDto, request?: Request) {
    try {
      return await this.appleUnsafe(dto, request);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = (error as Error)?.message || 'error desconocido';
      this.logger.error(`Apple login fallo: ${message}`, (error as Error)?.stack);
      if (this.config.get('NODE_ENV') !== 'production') {
        throw new BadRequestException(`No se pudo completar el inicio con Apple: ${message}`);
      }
      throw new UnauthorizedException('No se pudo completar el inicio con Apple.');
    }
  }

  private async appleUnsafe(dto: AppleLoginDto, request?: Request) {
    const locale = dto.locale === 'es' ? 'es' : 'en';
    const clientId = String(
      this.config.get<string>('APPLE_CLIENT_ID') || DEFAULT_APPLE_CLIENT_ID,
    ).trim();
    if (!clientId) {
      throw new BadRequestException('Falta configurar APPLE_CLIENT_ID.');
    }

    const payload = await this.applePayloadFromCredential(dto.credential, clientId);
    const appleSub = String(payload.sub || '').trim();
    const emailFromToken = String(payload.email || '')
      .toLowerCase()
      .trim();
    const fullName = String(dto.fullName || '').trim();
    const referrer = await this.findReferrer(dto.referralCode);
    const rawVerified = payload.email_verified;
    const emailVerified =
      rawVerified === true || rawVerified === 'true' || rawVerified === '1' || !emailFromToken;

    if (!appleSub) {
      throw new UnauthorizedException('No se pudo validar la cuenta de Apple.');
    }

    const existingBySub = await this.prisma.user.findFirst({
      where: { metadata: { path: ['appleSub'], equals: appleSub } },
    });
    const existingByEmail = emailFromToken
      ? await this.prisma.user.findFirst({ where: { email: emailFromToken } })
      : null;
    const existing = existingBySub || existingByEmail;

    if (existing) {
      const email = emailFromToken || existing.email;
      if (!email) {
        throw new UnauthorizedException(
          'Apple no envio email. Usa la misma Apple ID que compartio el correo la primera vez.',
        );
      }

      const emailTaken =
        existing.email !== email
          ? await this.prisma.user.findFirst({
              where: { email, id: { not: existing.id } },
              select: { id: true },
            })
          : null;

      const wasUnverified = !existing.emailVerifiedAt;
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          email: emailTaken ? existing.email : email,
          displayName:
            existing.displayName || fullName || usernameFromEmail(email),
          emailVerifiedAt: existing.emailVerifiedAt || (emailVerified ? new Date() : null),
          metadata: {
            ...((existing.metadata as Record<string, unknown>) || {}),
            appleSub,
            appleEmail: email,
            authProvider: 'apple',
            ...(!((existing.metadata as Record<string, unknown>) || {}).locale
              ? { locale }
              : {}),
          } as any,
        },
      });

      if (wasUnverified && updated.emailVerifiedAt) {
        this.lifecycleNotify.notifyWelcomeAsync(updated);
      }

      return this.authResponse(updated);
    }

    if (!emailFromToken) {
      throw new UnauthorizedException(
        'Apple no compartio el email. Activa "Compartir email" al iniciar sesion con Apple.',
      );
    }

    const email = emailFromToken;
    const baseUsername = usernameFromEmail(email);
    const username = await this.availableUsername(baseUsername, appleSub.slice(-6));
    const signupIpHash = this.resolveSignupIpHash(request);
    let signupSlotReserved = false;

    if (signupIpHash) {
      await this.reserveSignupSlot(signupIpHash);
      signupSlotReserved = true;
    }

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            username,
            displayName: fullName || username,
            photoUrl: null,
            referralCode: username,
            referredById: referrer?.userId || null,
            points: 25,
            emailVerifiedAt: new Date(),
            metadata: {
              appleSub,
              appleEmail: email,
              authProvider: 'apple',
              locale,
              ...(signupIpHash ? { signupIpHash } : {}),
            } as Prisma.InputJsonValue,
          },
        });
        await tx.referralCode.create({
          data: {
            code: username,
            userId: created.id,
            username,
          },
        });

        let createdUser = created;

        if (referrer && referrer.userId !== created.id) {
          const referrerUser = await tx.user.findUnique({ where: { id: referrer.userId } });
          const nextSignupCount = Number(referrerUser?.referralSignups || 0) + 1;
          const milestoneBonus = REFERRAL_MILESTONE_BONUSES[nextSignupCount] || 0;
          const pointsAwarded = REFERRAL_SIGNUP_POINTS + milestoneBonus;

          const referralSignup = await tx.referralSignup.create({
            data: {
              userId: created.id,
              referrerId: referrer.userId,
              referralCode: referrer.code,
              pointsAwarded,
              signupPoints: REFERRAL_SIGNUP_POINTS,
              milestoneBonus,
              milestone: milestoneBonus ? nextSignupCount : null,
            },
          });
          await tx.user.update({
            where: { id: referrer.userId },
            data: {
              points: { increment: pointsAwarded },
              referralPoints: { increment: pointsAwarded },
              referralSignups: { increment: 1 },
            },
          });
          createdUser = await this.applyReferralSignupBonus(tx, created, referralSignup.id);
          await this.applyReferralSignupMissions(tx, referrer.userId);
        }

        return createdUser;
      });
    } catch (error) {
      if (signupSlotReserved && signupIpHash) {
        void this.releaseSignupSlot(signupIpHash).catch(() => {});
      }
      throw error;
    }

    this.lifecycleNotify.notifyWelcomeAsync(user);
    void this.maybeAlertSpawnSignup(user, signupIpHash).catch(() => {});
    return this.authResponse(user);
  }

  private async applePayloadFromCredential(credential: string, clientId: string) {
    try {
      const { payload } = await jwtVerify(credential, APPLE_JWKS, {
        issuer: APPLE_ISSUER,
        audience: clientId,
      });
      return payload as {
        sub?: string;
        email?: string;
        email_verified?: boolean | string;
      };
    } catch (error) {
      this.logger.warn(`Apple jwtVerify fallo: ${(error as Error)?.message}`);
      throw new UnauthorizedException('El token de Apple no es valido o ya expiro.');
    }
  }

  private async maybeAlertSpawnSignup(user: User, signupIpHash: string | null) {
    if (!signupIpHash) return;

    const accountCount = await this.prisma.user.count({
      where: {
        metadata: {
          path: ['signupIpHash'],
          equals: signupIpHash,
        },
      },
    });

    await this.moderation.createSpawnSignupAlert({
      ipHash: signupIpHash,
      accountCount,
      userId: user.id,
      userName: user.displayName || user.username || user.email,
    });
  }

  private async googlePayloadFromCredential(client: OAuth2Client, clientId: string, credential: string) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      return ticket.getPayload();
    } catch (error) {
      this.logger.warn(`verifyIdToken fallo: ${(error as Error)?.message}`);
      throw new UnauthorizedException('El token de Google no es valido o ya expiro.');
    }
  }

  private async googlePayloadFromAccessToken(client: OAuth2Client, clientId: string, accessToken: string) {
    if (!accessToken) {
      throw new UnauthorizedException('No se recibio token de Google.');
    }

    let tokenInfo: TokenInfo;
    try {
      tokenInfo = await client.getTokenInfo(accessToken);
    } catch (error) {
      this.logger.warn(`getTokenInfo fallo: ${(error as Error)?.message}`);
      throw new UnauthorizedException('El token de Google no es valido o ya expiro.');
    }

    if (String(tokenInfo.aud || '').trim() !== clientId) {
      this.logger.warn(`Token emitido para otro client_id: ${tokenInfo.aud}`);
      throw new UnauthorizedException('Token de Google invalido para esta aplicacion.');
    }

    let response: Response;
    try {
      response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      this.logger.error(`No se pudo contactar con Google: ${(error as Error)?.message}`);
      throw new ServiceUnavailableException('No se pudo contactar con Google. Reintenta en unos segundos.');
    }

    if (!response.ok) {
      throw new UnauthorizedException('No se pudo leer el perfil de Google.');
    }

    const profile = await response.json();
    return {
      sub: profile.sub,
      email: profile.email,
      email_verified: profile.email_verified,
      name: profile.name,
      picture: profile.picture,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyToken(dto.refreshToken, 'refresh', this.refreshSecret());
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(payload.sub) } });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    if (user.passwordHash && !user.emailVerifiedAt) {
      throw new UnauthorizedException('Debes verificar tu correo antes de continuar.');
    }

    return this.authResponse(user);
  }

  async anonymous(dto: AnonymousTokenDto) {
    const anonymousId = dto.deviceId || randomUUID();
    const token = await this.jwt.signAsync(
      { sub: anonymousId, type: 'anonymous' } satisfies JwtPayload,
      {
        secret: this.anonymousSecret(),
        expiresIn: (this.config.get<string>('JWT_ANONYMOUS_EXPIRES_IN') || '365d') as any,
      },
    );

    return {
      anonymousId,
      accessToken: token,
      tokenType: 'anonymous',
    };
  }

  async resolveVoteIdentity(authorization?: string): Promise<VoteIdentity> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';

    if (!token) {
      throw new UnauthorizedException('Falta token de votacion.');
    }

    try {
      const access = await this.verifyToken(token, 'access', this.accessSecret());
      return {
        type: 'user',
        id: access.sub,
        userId: BigInt(access.sub),
        role: access.role,
      };
    } catch {
      const anonymous = await this.verifyToken(token, 'anonymous', this.anonymousSecret());
      return {
        type: 'anonymous',
        id: anonymous.sub,
      };
    }
  }

  private async authResponse(user: User) {
    void this.missionProgress.trackLogin(user.id).catch(() => {});

    const accessPayload: JwtPayload = {
      sub: user.id.toString(),
      type: 'access',
      role: user.role,
      username: user.username,
    };
    const refreshPayload: JwtPayload = {
      sub: user.id.toString(),
      type: 'refresh',
      role: user.role,
      username: user.username,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.accessSecret(),
        expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m') as any,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.refreshSecret(),
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d') as any,
      }),
    ]);

    return {
      user: this.publicUser(user),
      accessToken,
      refreshToken,
    };
  }

  private publicUser(user: User) {
    return {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      role: user.role,
      points: Number(user.points),
      spentPoints: Number(user.spentPoints),
      referralCode: user.referralCode,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  private resolveUserLocale(metadata: unknown): 'es' | 'en' {
    const meta =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
    const raw = String(meta.locale || meta.lang || meta.language || '')
      .trim()
      .toLowerCase();
    return raw.startsWith('es') ? 'es' : 'en';
  }

  private hashEmailVerificationCode(code: string) {
    return createHash('sha256').update(String(code || '').trim()).digest('hex');
  }

  private emailVerifyCodeKey(codeHash: string) {
    return `email-verify:${codeHash}`;
  }

  private emailVerifyUserKey(userId: bigint | string) {
    return `email-verify-user:${userId.toString()}`;
  }

  private async clearEmailVerificationKeys(userId: bigint | string, codeHash?: string | null) {
    const userKey = this.emailVerifyUserKey(userId);
    const previousHash = codeHash || (await this.redis.client.get(userKey));
    if (previousHash) {
      await this.redis.client.del(this.emailVerifyCodeKey(previousHash));
    }
    await this.redis.client.del(userKey);
  }

  private generateEmailVerificationCode() {
    const max = 10 ** EMAIL_VERIFY_CODE_LENGTH;
    const value = randomBytes(4).readUInt32BE(0) % max;
    return String(value).padStart(EMAIL_VERIFY_CODE_LENGTH, '0');
  }

  private async issueEmailVerificationCode(
    user: Pick<User, 'id' | 'email' | 'displayName' | 'username'>,
    locale: 'es' | 'en' = 'en',
  ) {
    if (!user.email) {
      throw new BadRequestException('La cuenta no tiene correo.');
    }

    if (!this.mail.isConfigured()) {
      if (this.config.get('NODE_ENV') !== 'production') {
        throw new ServiceUnavailableException(
          'Falta configurar SMTP_HOST / SMTP_USER / SMTP_PASS en backend/.env para enviar el correo.',
        );
      }
      this.logger.warn('email-verification: SMTP no configurado');
      return;
    }

    const code = this.generateEmailVerificationCode();
    const codeHash = this.hashEmailVerificationCode(code);
    await this.clearEmailVerificationKeys(user.id);
    await this.redis.client.set(
      this.emailVerifyCodeKey(codeHash),
      user.id.toString(),
      'EX',
      EMAIL_VERIFY_TTL_SECONDS,
    );
    await this.redis.client.set(this.emailVerifyUserKey(user.id), codeHash, 'EX', EMAIL_VERIFY_TTL_SECONDS);

    try {
      await this.mail.sendEmailVerification({
        to: user.email,
        name: user.displayName || user.username || '',
        code,
        locale,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar verificacion a ${user.email}: ${(error as Error).message}`);
      if (this.config.get('NODE_ENV') !== 'production') {
        await this.clearEmailVerificationKeys(user.id, codeHash);
        throw new ServiceUnavailableException(`No se pudo enviar el correo: ${(error as Error).message}`);
      }
      // Keep the code in Redis so "Resend" or a delayed delivery can still work;
      // register must not fail after the account was created.
      this.logger.warn(
        `Registro de ${user.email} con posible fallo SMTP; el usuario puede reenviar el codigo.`,
      );
    }
  }

  private async findReferrer(referralCode?: string) {
    const code = String(referralCode || '').trim().toLowerCase();
    if (!code) {
      return null;
    }

    return this.prisma.referralCode.findUnique({ where: { code } });
  }

  private async applyReferralSignupBonus(
    tx: Prisma.TransactionClient,
    user: User,
    referralSignupId?: bigint,
  ) {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { points: { increment: REFERRAL_SIGNUP_POINTS } },
    });

    await tx.notification.create({
      data: {
        userId: user.id,
        type: 'admin_points_gift',
        payload: {
          amount: REFERRAL_SIGNUP_POINTS,
          pointsBefore: user.points.toString(),
          pointsAfter: updatedUser.points.toString(),
          title: 'Regalo de bienvenida',
          message: `Recibiste ${REFERRAL_SIGNUP_POINTS} puntos por registrarte con un enlace de invitación.`,
          referralSignupId: referralSignupId?.toString() || null,
          source: 'referral_signup',
        },
      },
    });

    return updatedUser;
  }

  private async applyReferralSignupMissions(
    tx: Prisma.TransactionClient,
    referrerId: bigint,
  ) {
    await this.missionProgress.progressForTypesInTx(tx, referrerId, [
      'referral_signup',
      'referral_signup_milestone',
    ]);
  }

  private async availableUsername(baseUsername: string, suffix: string) {
    const candidates = [
      baseUsername,
      `${baseUsername}_${suffix.toLowerCase()}`.slice(0, 32),
      `google_${suffix.toLowerCase()}`,
    ];

    for (const candidate of candidates) {
      const existing = await this.prisma.user.findFirst({
        where: {
          OR: [{ username: candidate }, { referralCode: candidate }],
        },
        select: { id: true },
      });
      if (!existing) {
        const codeTaken = await this.prisma.referralCode.findUnique({
          where: { code: candidate },
          select: { id: true },
        });
        if (!codeTaken) return candidate;
      }
    }

    return `google_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }

  private async verifyToken(token: string, type: JwtPayload['type'], secret: string) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
      if (payload.type !== type) {
        throw new BadRequestException('Tipo de token invalido.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Token invalido.');
    }
  }

  private accessSecret() {
    return this.config.get<string>('JWT_ACCESS_SECRET') || 'change-me-access-secret';
  }

  private refreshSecret() {
    return this.config.get<string>('JWT_REFRESH_SECRET') || 'change-me-refresh-secret';
  }

  private anonymousSecret() {
    return this.config.get<string>('JWT_ANONYMOUS_SECRET') || 'change-me-anonymous-secret';
  }

  private signupMaxPerIp() {
    const configured = Number(this.config.get('SIGNUP_MAX_PER_IP') || DEFAULT_SIGNUP_MAX_PER_IP);
    return Number.isFinite(configured) && configured > 0
      ? Math.min(20, Math.floor(configured))
      : DEFAULT_SIGNUP_MAX_PER_IP;
  }

  private signupIpCountKey(ipHash: string) {
    return `auth:signup-count:${ipHash}`;
  }

  private resolveSignupIpHash(request?: Request) {
    if (!request) {
      return null;
    }

    const clientIp = getClientIp(request);
    if (!clientIp || clientIp === 'unknown') {
      return null;
    }

    return hashIp(clientIp, this.config.get<string>('IP_HASH_SALT') || 'votomusicamundial');
  }

  private async enforceSignupIpNotBlocked(ipHash: string) {
    const blocked = await this.redis.client.hexists(BLOCKED_IPS_KEY, ipHash);
    if (blocked) {
      throw new ForbiddenException('No se pueden crear cuentas desde esta conexion.');
    }
  }

  private async syncSignupIpCount(ipHash: string) {
    const key = this.signupIpCountKey(ipHash);
    const exists = await this.redis.client.exists(key);
    if (exists) {
      return;
    }

    const dbCount = await this.prisma.user.count({
      where: {
        metadata: {
          path: ['signupIpHash'],
          equals: ipHash,
        },
      },
    });

    if (dbCount > 0) {
      await this.redis.client.set(key, dbCount.toString());
    }
  }

  private async reserveSignupSlot(ipHash: string) {
    await this.enforceSignupIpNotBlocked(ipHash);
    await this.syncSignupIpCount(ipHash);

    const max = this.signupMaxPerIp();
    const key = this.signupIpCountKey(ipHash);
    const next = await this.redis.client.incr(key);

    if (next > max) {
      await this.redis.client.decr(key);
      throw new HttpException(
        `Solo se permiten ${max} cuentas por conexion. Si necesitas ayuda, contacta soporte.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async releaseSignupSlot(ipHash: string) {
    const key = this.signupIpCountKey(ipHash);
    const current = Number(await this.redis.client.get(key) || 0);
    if (current <= 0) {
      return;
    }
    await this.redis.client.decr(key);
  }
}
