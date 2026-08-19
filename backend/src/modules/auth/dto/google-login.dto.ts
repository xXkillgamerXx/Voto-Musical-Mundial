import { IsOptional, IsString, Length } from 'class-validator';

export class GoogleLoginDto {
  @IsOptional()
  @IsString()
  @Length(20, 16384)
  credential?: string;

  @IsOptional()
  @IsString()
  @Length(20, 16384)
  accessToken?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
