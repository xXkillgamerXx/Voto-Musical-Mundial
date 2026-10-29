import { ArrayMaxSize, IsArray, IsOptional, IsString, Length } from 'class-validator';

export class CreateForumTopicDto {
  @IsString()
  @Length(2, 48)
  category: string;

  @IsString()
  @Length(8, 140)
  title: string;

  @IsString()
  @Length(12, 8000)
  body: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[];
}
