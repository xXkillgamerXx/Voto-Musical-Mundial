import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { FORUM_ICONS } from '../forum.constants';

export class CreateForumCategoryDto {
  @IsOptional()
  @IsString()
  @Length(2, 48)
  slug?: string;

  @IsString()
  @Length(2, 48)
  nameEs: string;

  @IsString()
  @Length(2, 48)
  nameEn: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  blurbEs?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  blurbEn?: string;

  @IsOptional()
  @IsIn([...FORUM_ICONS])
  icon?: (typeof FORUM_ICONS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVip?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 48)
  parentSlug?: string;
}

export class UpdateForumCategoryDto {
  @IsOptional()
  @IsString()
  @Length(2, 48)
  nameEs?: string;

  @IsOptional()
  @IsString()
  @Length(2, 48)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  blurbEs?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  blurbEn?: string;

  @IsOptional()
  @IsIn([...FORUM_ICONS])
  icon?: (typeof FORUM_ICONS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVip?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 48)
  parentSlug?: string;
}
