import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth.types';
import { PresenceService } from './presence.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') || 'change-me-access-secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token invalido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        points: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    void this.presence.touch(user.id);

    return user;
  }
}
