import { IsString, Length } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @Length(20, 4096)
  credential: string;
}
