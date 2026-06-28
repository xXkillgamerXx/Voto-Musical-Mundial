import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { AnonymousTokenDto } from './dto/anonymous-token.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload, VoteIdentity } from './auth.types';

const REFERRAL_SIGNUP_POINTS = 50;
const REFERRAL_MILESTONE_BONUSES: Record<number, number> = {
  5: 300,
  10: 700,
};

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedUsername = dto.username.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const referrer = await this.findReferrer(dto.referralCode);

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
    });

    if (existing?.email === normalizedEmail) {
      throw new ConflictException('Ese correo ya esta registrado.');
    }

    if (existing?.username === normalizedUsername) {
      throw new ConflictException('Ese username ya esta en uso.');
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
          metadata: (dto.metadata || {}) as any,
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
      if (error?.code === 'P2002') {
        throw new ConflictException('Ese correo o username ya esta registrado.');
      }

      if (error?.code === 'P2021' || error?.code === 'P2022') {
        throw new BadRequestException('La base PostgreSQL no tiene las tablas actualizadas. Ejecuta las migraciones de Prisma.');
      }

      throw error;
    });

    return this.authResponse(user);
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

    return this.authResponse(user);
  }

  async google(dto: GoogleLoginDto) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('Falta configurar GOOGLE_CLIENT_ID.');
    }

    const client = new OAuth2Client(clientId);
    const payload = dto.credential
      ? await this.googlePayloadFromCredential(client, clientId, dto.credential)
      : await this.googlePayloadFromAccessToken(client, clientId, dto.accessToken || '');
    const email = payload?.email?.toLowerCase().trim();
    const referrer = await this.findReferrer(dto.referralCode);

    if (!payload?.sub || !email || !payload.email_verified) {
      throw new UnauthorizedException('No se pudo validar la cuenta de Google.');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { metadata: { path: ['googleSub'], equals: payload.sub } },
        ],
      },
    });

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          displayName: existing.displayName || payload.name || usernameFromEmail(email),
          photoUrl: payload.picture || existing.photoUrl,
          metadata: {
            ...((existing.metadata as Record<string, unknown>) || {}),
            googleSub: payload.sub,
            googleEmail: email,
            googlePicture: payload.picture || null,
            authProvider: 'google',
          } as any,
        },
      });

      return this.authResponse(updated);
    }

    const baseUsername = usernameFromEmail(email);
    const username = await this.availableUsername(baseUsername, payload.sub.slice(-6));
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username,
          displayName: payload.name || username,
          photoUrl: payload.picture || null,
          referralCode: username,
          referredById: referrer?.userId || null,
          points: 25,
          metadata: {
            googleSub: payload.sub,
            googleEmail: email,
            googlePicture: payload.picture || null,
            authProvider: 'google',
          } as any,
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

    return this.authResponse(user);
  }

  private async googlePayloadFromCredential(client: OAuth2Client, clientId: string, credential: string) {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    return ticket.getPayload();
  }

  private async googlePayloadFromAccessToken(client: OAuth2Client, clientId: string, accessToken: string) {
    if (!accessToken) {
      throw new UnauthorizedException('No se recibio token de Google.');
    }

    const tokenInfo = await client.getTokenInfo(accessToken);
    if (tokenInfo.aud !== clientId) {
      throw new UnauthorizedException('Token de Google invalido para esta aplicacion.');
    }

    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
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
    };
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
    const missions = await tx.mission.findMany({
      where: {
        active: true,
        type: { in: ['referral_signup', 'referral_signup_milestone'] },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    for (const mission of missions) {
      const completion = await tx.missionCompletion.upsert({
        where: { missionId_userId: { missionId: mission.id, userId: referrerId } },
        update: {
          progress: { increment: 1 },
        },
        create: {
          missionId: mission.id,
          userId: referrerId,
          progress: 1,
        },
      });
      const nextProgress = Math.min(Math.max(completion.progress, 1), mission.target);

      if (completion.rewardedAt) {
        continue;
      }

      if (nextProgress < mission.target) {
        await tx.missionCompletion.update({
          where: { id: completion.id },
          data: { progress: nextProgress },
        });
        continue;
      }

      const updatedUser = await tx.user.update({
        where: { id: referrerId },
        data: { points: { increment: mission.rewardPoints } },
      });

      await tx.notification.create({
        data: {
          userId: referrerId,
          type: 'mission_completed',
          payload: {
            title: 'Mision completada',
            message: `Completaste "${mission.title}" y ganaste ${mission.rewardPoints} puntos.`,
            missionId: mission.id.toString(),
            missionTitle: mission.title,
            rewardPoints: mission.rewardPoints,
            pointsAfter: updatedUser.points.toString(),
            url: '/notificaciones',
          },
        },
      });

      await tx.missionCompletion.update({
        where: { id: completion.id },
        data: {
          progress: mission.target,
          completedAt: new Date(),
          rewardedAt: new Date(),
        },
      });
    }
  }

  private async availableUsername(baseUsername: string, suffix: string) {
    const candidates = [
      baseUsername,
      `${baseUsername}_${suffix.toLowerCase()}`.slice(0, 32),
      `google_${suffix.toLowerCase()}`,
    ];

    for (const candidate of candidates) {
      const existing = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!existing) return candidate;
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
}
