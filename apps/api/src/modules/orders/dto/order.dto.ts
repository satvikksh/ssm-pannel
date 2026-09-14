import { IsString, IsNumber, IsOptional, Min, Max, IsMongoId } from "class-validator";

export class CreateOrderDto {
  @IsMongoId() serviceId!: string;
  @IsString() @Max(2048) link!: string;
  @IsNumber() @Min(1) @Max(10_000_000) quantity!: number;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsString() @Min(8) @Max(128) idempotencyKey?: string;
}