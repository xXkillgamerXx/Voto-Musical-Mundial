import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { NoStoreInterceptor } from '../../common/no-store.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserActivityService } from '../admin/user-activity.service';
import { UsersService } from './users.service';

const profileUploadsPath = join(process.cwd(), 'uploads', 'profile');
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('users')
@UseInterceptors(NoStoreInterceptor)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly activity: UserActivityService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: bigint }) {
    return this.users.findById(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: { id: bigint }, @Body() body: unknown) {
    return this.users.updateProfile(user.id, body);
  }

  @Post('me/uploads')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          if (!existsSync(profileUploadsPath)) {
            mkdirSync(profileUploadsPath, { recursive: true });
          }
          callback(null, profileUploadsPath);
        },
        filename: (_request, file, callback) => {
          const extension = extname(file.originalname || '').toLowerCase() || '.jpg';
          callback(null, `${Date.now()}-${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!allowedImageTypes.has(file.mimetype)) {
          callback(new BadRequestException('Solo se permiten imagenes JPG, PNG o WEBP.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadProfileImage(@UploadedFile() file: any, @Req() request: any) {
    if (!file) throw new BadRequestException('No se recibio ninguna imagen.');

    const configured = String(
      process.env.PUBLIC_WEB_ORIGIN ||
        process.env.APP_PUBLIC_ORIGIN ||
        process.env.APP_ORIGIN ||
        '',
    )
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    const host = String(request.get('host') || '').toLowerCase();
    const badHost =
      !configured &&
      (host.includes('vote.musicmundial.com') ||
        host.startsWith('localhost') ||
        host.startsWith('127.0.0.1') ||
        /^\d+\.\d+\.\d+\.\d+/.test(host));
    const origin =
      configured ||
      (badHost ? 'https://www.musicmundial.com' : `${request.protocol}://${request.get('host')}`);
    const path = `/uploads/profile/${file.filename}`;
    return {
      url: `${origin}${path}`,
      path,
    };
  }

  @Get('me/username/:username')
  @UseGuards(JwtAuthGuard)
  checkUsername(@CurrentUser() user: { id: bigint }, @Param('username') username: string) {
    return this.users.checkUsername(username, user.id);
  }

  @Get('me/referral')
  @UseGuards(JwtAuthGuard)
  referral(@CurrentUser() user: { id: bigint }) {
    return this.users.referral(user.id);
  }

  @Get('me/activity')
  @UseGuards(JwtAuthGuard)
  myActivity(@CurrentUser() user: { id: bigint }) {
    return this.activity.getActivity(user.id.toString(), 300);
  }

  @Get(':username')
  publicProfile(@Param('username') username: string) {
    return this.users.findPublicByUsername(username);
  }
}
