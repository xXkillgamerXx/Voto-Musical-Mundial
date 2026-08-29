import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendBulkEmailDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subjectEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  messageEn?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsBoolean()
  sendToAll?: boolean;

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
  @MaxLength(80)
  ctaLabelEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pollTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pollTitleEn?: string;

  @IsOptional()
  @IsIn(['broadcast', 'poll'])
  template?: 'broadcast' | 'poll';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitleEn?: string;
}
