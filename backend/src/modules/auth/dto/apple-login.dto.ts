import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class AppleLoginDto {
  @IsString()
  @Length(20, 16384)
  credential!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';
}
