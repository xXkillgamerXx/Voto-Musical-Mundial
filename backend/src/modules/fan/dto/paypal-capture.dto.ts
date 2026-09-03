import { IsString } from 'class-validator';

export class PaypalCaptureDto {
  @IsString()
  orderId: string;
}
