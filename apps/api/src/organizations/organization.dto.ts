import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  CREATABLE_ORGANIZATION_KINDS,
  ORGANIZATION_KINDS,
  ORGANIZATION_SEGMENTS,
  ORGANIZATION_STATUSES,
  type OrganizationKind,
  type OrganizationSegment,
  type OrganizationStatus,
} from "@ems/domain";
import { PageMetaDto, PaginationQueryDto } from "../common/dto";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") return value;
  const t = value.trim();
  return t === "" ? null : t;
};
const upperOrNull = ({ value }: { value: unknown }) =>
  typeof value === "string" ? (value.trim() === "" ? null : value.trim().toUpperCase()) : value;

/** Optional, nullable profile fields shared by create and update. */
class OrganizationProfileFields {
  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(300)
  legalName?: string | null;

  @ApiPropertyOptional({ enum: ORGANIZATION_SEGMENTS, nullable: true })
  @IsOptional()
  @IsIn(ORGANIZATION_SEGMENTS)
  segment?: OrganizationSegment | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  industry?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 300, example: "https://example.com" })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(300)
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  addressLine1?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  region?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 20 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "ISO 3166-1 alpha-2", example: "US" })
  @IsOptional()
  @Transform(upperOrNull)
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ nullable: true, format: "uuid", description: "Accountable EMS user" })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;
}

export class CreateOrganizationDto extends OrganizationProfileFields {
  @ApiProperty({ minLength: 2, maxLength: 200, example: "Harbor Point Automation" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: CREATABLE_ORGANIZATION_KINDS })
  @IsIn(CREATABLE_ORGANIZATION_KINDS)
  kind: OrganizationKind;
}

export class UpdateOrganizationDto extends OrganizationProfileFields {
  @ApiProperty({ description: "Current version, for optimistic concurrency" })
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({ minLength: 2, maxLength: 200 })
  @ValidateIf((o: UpdateOrganizationDto) => o.name !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_KINDS })
  @ValidateIf((o: UpdateOrganizationDto) => o.kind !== undefined)
  @IsIn(ORGANIZATION_KINDS)
  kind?: OrganizationKind;

  @ApiPropertyOptional({
    enum: ["active", "inactive"],
    description: "Use archive/restore for archiving",
  })
  @ValidateIf((o: UpdateOrganizationDto) => o.status !== undefined)
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}

export class VersionDto {
  @ApiProperty({ description: "Current version, for optimistic concurrency" })
  @IsInt()
  @Min(1)
  version: number;
}

export const ORGANIZATION_SORT_FIELDS = ["name", "createdAt", "updatedAt"] as const;

export class ListOrganizationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100, description: "Case-insensitive name search" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_KINDS })
  @IsOptional()
  @IsIn(ORGANIZATION_KINDS)
  kind?: OrganizationKind;

  @ApiPropertyOptional({ enum: ORGANIZATION_STATUSES })
  @IsOptional()
  @IsIn(ORGANIZATION_STATUSES)
  status?: OrganizationStatus;

  @ApiPropertyOptional({ default: false, description: "Include archived organizations" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({ enum: ORGANIZATION_SORT_FIELDS, default: "name" })
  @IsOptional()
  @IsIn(ORGANIZATION_SORT_FIELDS)
  sort?: (typeof ORGANIZATION_SORT_FIELDS)[number];

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "asc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}

export class OrganizationDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) legalName: string | null;
  @ApiProperty({ enum: ORGANIZATION_KINDS }) kind: OrganizationKind;
  @ApiProperty({ enum: ORGANIZATION_STATUSES }) status: OrganizationStatus;
  @ApiProperty({ enum: ORGANIZATION_SEGMENTS, nullable: true }) segment: OrganizationSegment | null;
  @ApiProperty({ type: String, nullable: true }) industry: string | null;
  @ApiProperty({ type: String, nullable: true }) website: string | null;
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  @ApiProperty({ type: String, nullable: true }) addressLine1: string | null;
  @ApiProperty({ type: String, nullable: true }) addressLine2: string | null;
  @ApiProperty({ type: String, nullable: true }) city: string | null;
  @ApiProperty({ type: String, nullable: true }) region: string | null;
  @ApiProperty({ type: String, nullable: true }) postalCode: string | null;
  @ApiProperty({ type: String, nullable: true }) countryCode: string | null;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) ownerUserId: string | null;
  @ApiProperty({ format: "date-time" }) createdAt: string;
  @ApiProperty({ format: "date-time" }) updatedAt: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) archivedAt: string | null;
  @ApiProperty() version: number;
}

export class OrganizationPageDto {
  @ApiProperty({ type: [OrganizationDto] }) data: OrganizationDto[];
  @ApiProperty({ type: PageMetaDto }) meta: PageMetaDto;
}
