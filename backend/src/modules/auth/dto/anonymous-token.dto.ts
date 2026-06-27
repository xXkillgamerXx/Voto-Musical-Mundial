import { IsOptional, IsString } from 'class-validator';

export class AnonymousTokenDto {
  @IsOptional()
  @IsString()
  deviceId?: string;
}
