import { IsEmail, IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendEmailVerificationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'])
  locale?: string;
}
