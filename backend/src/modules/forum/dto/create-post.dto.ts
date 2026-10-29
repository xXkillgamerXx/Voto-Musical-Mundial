import { ArrayMaxSize, IsArray, IsOptional, IsString, Length } from 'class-validator';

export class CreateForumPostDto {
  @IsString()
  @Length(2, 8000)
  body: string;

  @IsOptional()
  @IsString()
  replyToPostId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[];
}
