import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { UserRole } from "@smm/types";

const ASSIGNABLE_ROLES = [
  UserRole.ADMIN,
];

export class CreateAdminDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(["active", "suspended", "banned"])
  status?: "active" | "suspended" | "banned";

  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(["active", "suspended", "banned"])
  status?: "active" | "suspended" | "banned";

  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class ResetAdminPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}