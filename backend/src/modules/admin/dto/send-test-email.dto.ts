import { IsEmail, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTestEmailDto {
  @IsEmail()
  to: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsIn(['test', 'broadcast', 'poll'])
  mode?: 'test' | 'broadcast' | 'poll';

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsObject()
  vars?: Record<string, string>;
}
