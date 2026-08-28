import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class VerificationCopyFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  preheader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  intro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  expiryBody?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  expiryBadge?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  security?: string;
}

export class PreviewEmailDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsIn(['test', 'broadcast', 'verification'])
  mode?: 'test' | 'broadcast' | 'verification';

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  code?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VerificationCopyFieldsDto)
  copy?: VerificationCopyFieldsDto;
}

export class UpdateVerificationCopyDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VerificationCopyFieldsDto)
  es?: VerificationCopyFieldsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VerificationCopyFieldsDto)
  en?: VerificationCopyFieldsDto;
}

export class SendVerificationTestEmailDto {
  @IsEmail()
  to: string;

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  code?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VerificationCopyFieldsDto)
  copy?: VerificationCopyFieldsDto;
}
