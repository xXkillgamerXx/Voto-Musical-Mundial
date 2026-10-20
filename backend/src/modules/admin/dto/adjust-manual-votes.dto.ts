import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class AdjustManualVotesDto {
  @Type(() => Number)
  @IsInt()
  amount: number;
}
