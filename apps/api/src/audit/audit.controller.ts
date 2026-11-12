import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { PERMISSIONS } from "@ems/domain";
import type { Prisma } from "@ems/db";
import { CurrentPrincipal, RequirePermission } from "../auth/decorators";
import type { AuthenticatedPrincipal } from "../auth/principal.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { PageMetaDto, PaginationQueryDto } from "../common/dto";
import { forbidden } from "../common/problem";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "./audit.service";

export class ListAuditEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: "organization" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z_]{1,60}$/)
  entityType?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ example: "organization.updated" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;
}

export class AuditEventDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ description: "Monotonic sequence (string-encoded bigint)" }) sequence: string;
  @ApiProperty({ format: "date-time" }) occurredAt: string;
  @ApiProperty({ enum: ["user", "agent", "system", "workflow"] }) actorType: string;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) actorUserId: string | null;
  @ApiProperty({ type: String, nullable: true }) actorDisplayName: string | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) organizationId: string | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) projectId: string | null;
  @ApiProperty() action: string;
  @ApiProperty() entityType: string;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) entityId: string | null;
  @ApiProperty({ type: Object, nullable: true }) before: unknown;
  @ApiProperty({ type: Object, nullable: true }) after: unknown;
  @ApiProperty({ type: String, nullable: true }) requestId: string | null;
  @ApiProperty() hash: string;
}

export class AuditEventPageDto {
  @ApiProperty({ type: [AuditEventDto] }) data: AuditEventDto[];
  @ApiProperty({ type: PageMetaDto }) meta: PageMetaDto;
}

export class AuditChainVerificationDto {
  @ApiProperty() ok: boolean;
  @ApiProperty() eventsChecked: number;
  @ApiProperty({ type: String, nullable: true }) firstInvalidSequence: string | null;
  @ApiProperty({ type: String, nullable: true }) reason: string | null;
}

@ApiTags("audit")
@ApiBearerAuth()
@Controller({ path: "audit-events", version: "1" })
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_READ)
  @ApiOperation({
    operationId: "listAuditEvents",
    summary: "List audit events in the caller's scope",
  })
  @ApiOkResponse({ type: AuditEventPageDto })
  async list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() q: ListAuditEventsQueryDto,
  ): Promise<AuditEventPageDto> {
    const scope = this.authz.scope(principal, PERMISSIONS.AUDIT_READ);
    const tenant: Prisma.AuditEventWhereInput = scope.all
      ? {}
      : { organizationId: { in: [...scope.organizationIds] } };
    const where: Prisma.AuditEventWhereInput = {
      AND: [
        tenant,
        q.entityType ? { entityType: q.entityType } : {},
        q.entityId ? { entityId: q.entityId } : {},
        q.organizationId ? { organizationId: q.organizationId } : {},
        q.action ? { action: q.action } : {},
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { sequence: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((v): v is string => !!v))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, displayName: true },
    });
    const nameById = new Map(actors.map((a) => [a.id, a.displayName]));
    return {
      data: rows.map((r) => ({
        id: r.id,
        sequence: r.sequence.toString(),
        occurredAt: r.occurredAt.toISOString(),
        actorType: r.actorType,
        actorUserId: r.actorUserId,
        actorDisplayName: r.actorUserId ? (nameById.get(r.actorUserId) ?? null) : null,
        organizationId: r.organizationId,
        projectId: r.projectId,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        before: r.before,
        after: r.after,
        requestId: r.requestId,
        hash: r.hash,
      })),
      meta: { page: q.page, pageSize: q.pageSize, total },
    };
  }

  @Get("verify")
  @RequirePermission(PERMISSIONS.AUDIT_READ)
  @ApiOperation({
    operationId: "verifyAuditChain",
    summary: "Recompute the audit hash chain (platform-wide audit readers only)",
  })
  @ApiOkResponse({ type: AuditChainVerificationDto })
  async verify(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AuditChainVerificationDto> {
    if (!this.authz.scope(principal, PERMISSIONS.AUDIT_READ).all) {
      throw forbidden("FORBIDDEN", "Only platform-wide audit readers may verify the chain.");
    }
    return this.audit.verifyChain();
  }
}
