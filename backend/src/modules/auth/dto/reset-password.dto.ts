import { IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]+$/)
  token: string;

  @IsString()
  @Length(8, 128)
  password: string;
}
