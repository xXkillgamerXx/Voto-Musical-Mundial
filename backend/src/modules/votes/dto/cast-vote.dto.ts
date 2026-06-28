import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CastVoteDto {
  @IsString()
  pollId: string;

  @IsOptional()
  @IsString()
  roundId?: string;

  @IsOptional()
  @IsString()
  contestantId?: string;

  @IsOptional()
  @IsString()
  artistId?: string;

  @IsOptional()
  @IsString()
  voteScope?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  amount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsPerVote?: number;
}
