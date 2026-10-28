import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpsertNewsPostDto {
  @IsString()
  @Length(3, 220)
  title: string;

  @IsOptional()
  @IsString()
  @Length(1, 180)
  slug?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsIn(['draft', 'publish', 'scheduled', 'trash'])
  status?: 'draft' | 'publish' | 'scheduled' | 'trash';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  authorName?: string;

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';

  @IsOptional()
  @IsString()
  authorUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  wpAuthorId?: number;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  attachments?: Array<{ url?: string; type?: string; name?: string }>;

  @IsOptional()
  @IsString()
  altSlug?: string;

  @IsOptional()
  @IsString()
  altPostId?: string;
}

export class CreateNewsCommentDto {
  @IsString()
  @Length(2, 800)
  text: string;
}

export class UpsertNewsCategoryDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  nav?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}
