import { IsOptional, IsString, Length } from 'class-validator';

export class GoogleLoginDto {
  @IsOptional()
  @IsString()
  @Length(20, 4096)
  credential?: string;

  @IsOptional()
  @IsString()
  @Length(20, 4096)
  accessToken?: string;
}
