import { IsString, IsOptional, IsNumber, IsEnum, Min, IsObject } from "class-validator";

export class CreateProviderDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsString() adapter!: string;
  @IsString() baseUrl!: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsString() apiSecret?: string;
  @IsOptional() @IsEnum(["query", "body", "header"]) authStyle?: "query" | "body" | "header";
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Min(1000) timeoutMs?: number;
  @IsOptional() @IsNumber() @Min(0) retries?: number;
  @IsOptional() @IsObject() responseMapping?: Record<string, unknown>;
}