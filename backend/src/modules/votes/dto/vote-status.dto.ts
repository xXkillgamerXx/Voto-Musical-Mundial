import { IsOptional, IsString } from 'class-validator';

export class VoteStatusDto {
  @IsString()
  pollId: string;

  @IsOptional()
  @IsString()
  roundId?: string;

  @IsOptional()
  @IsString()
  voteScope?: string;
}
