import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { assertSecurityConfig, resolveCorsOrigins } from './common/security-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  assertSecurityConfig(config);
  const corsOrigins = resolveCorsOrigins(config);

  // Behind the aaPanel Apache reverse proxy: trust exactly one hop so request.ip is the
  // real client and X-Forwarded-For cannot be spoofed to bypass rate limits / cooldowns.
  app.set('trust proxy', 1);

  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true });
  app.use((req, res, next) => {
    if (/\/news\/(sitemaps|feed|share)(\/|$)/.test(req.path || '')) return next();
    return helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })(req, res, next);
  });
  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  await app.listen(Number(config.get('PORT') || 4000));
}

void bootstrap();
