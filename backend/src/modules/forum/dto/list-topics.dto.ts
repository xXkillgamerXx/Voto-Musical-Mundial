import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListForumTopicsDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsIn(['latest', 'activity', 'replies', 'popular'])
  sort?: 'latest' | 'activity' | 'replies' | 'popular';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';
}
