import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';
}
