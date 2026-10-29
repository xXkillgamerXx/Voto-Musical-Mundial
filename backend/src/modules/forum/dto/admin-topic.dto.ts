import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class AdminListForumTopicsDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['all', 'active', 'hidden', 'closed', 'pinned'])
  status?: 'all' | 'active' | 'hidden' | 'closed' | 'pinned';

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';
}

export class AdminUpdateForumTopicDto {
  @IsOptional()
  @IsString()
  @Length(8, 140)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(2, 48)
  category?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  closed?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hidden?: boolean;
}
