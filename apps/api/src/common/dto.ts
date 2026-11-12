import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class PaginationQueryDto {
  @ApiPropertyOptional({ type: "integer", minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ type: "integer", minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}

export class PageMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}

export class ProblemFieldErrorDto {
  @ApiPropertyOptional() field?: string;
  @ApiProperty() code: string;
  @ApiProperty() message: string;
}

/** RFC 9457 problem details, documented for clients. */
export class ProblemDto {
  @ApiProperty() type: string;
  @ApiProperty() title: string;
  @ApiProperty() status: number;
  @ApiProperty({ description: "Stable machine-readable error code" }) code: string;
  @ApiProperty() detail: string;
  @ApiPropertyOptional({ type: [ProblemFieldErrorDto] }) errors?: ProblemFieldErrorDto[];
  @ApiProperty() instance: string;
  @ApiPropertyOptional() requestId?: string;
}
