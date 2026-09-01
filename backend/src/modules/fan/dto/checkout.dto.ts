import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

export class FanCheckoutArtistDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  slug?: string;
}

export class FanCheckoutDto {
  @IsString()
  sku: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  yearly?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  countryName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FanCheckoutArtistDto)
  artists?: FanCheckoutArtistDto[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  adopt?: boolean;
}
