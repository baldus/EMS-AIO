import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@ems/domain";
import { CurrentPrincipal, RequirePermission } from "../auth/decorators";
import type { AuthenticatedPrincipal } from "../auth/principal.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects";

export class KindCountDto {
  @ApiProperty() kind: string;
  @ApiProperty() count: number;
}

export class RecentActivityDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ format: "date-time" }) occurredAt: string;
  @ApiProperty() action: string;
  @ApiProperty() entityType: string;
  @ApiProperty({ type: String, nullable: true }) entityId: string | null;
  @ApiProperty({ type: String, nullable: true }) actorDisplayName: string | null;
}

export class DashboardSummaryDto {
  @ApiProperty({ type: [KindCountDto], description: "Non-archived organizations by kind" })
  organizationsByKind: KindCountDto[];
  @ApiProperty() activeProjects: number;
  @ApiProperty() activeEngagements: number;
  @ApiProperty({
    type: [RecentActivityDto],
    description: "Empty unless the caller may read audit history",
  })
  recentActivity: RecentActivityDto[];
}

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller({ path: "dashboard", version: "1" })
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly projects: ProjectsService,
  ) {}

  @Get("summary")
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  @ApiOperation({
    operationId: "getDashboardSummary",
    summary: "Counts and recent activity in the caller's scope",
  })
  @ApiOkResponse({ type: DashboardSummaryDto })
  async summary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DashboardSummaryDto> {
    const orgScope = this.authz.scope(principal, PERMISSIONS.ORGANIZATION_READ);
    const orgIds = [
      ...new Set([...orgScope.organizationIds, ...orgScope.organizationIdsViaProjects]),
    ];
    const orgWhere = orgScope.all ? {} : { id: { in: orgIds } };

    const projectTenant = this.projects.readableWhere(principal);
    const auditScope = this.authz.scope(principal, PERMISSIONS.AUDIT_READ);
    const canReadAudit = auditScope.all || auditScope.organizationIds.length > 0;

    const [byKind, activeProjects, projectIds, recent] = await Promise.all([
      this.prisma.organization.groupBy({
        by: ["kind"],
        where: { ...orgWhere, status: { not: "archived" } },
        _count: { _all: true },
      }),
      projectTenant
        ? this.prisma.project.count({ where: { AND: [projectTenant, { status: "active" }] } })
        : Promise.resolve(0),
      projectTenant
        ? this.prisma.project.findMany({ where: projectTenant, select: { id: true } })
        : Promise.resolve([]),
      canReadAudit
        ? this.prisma.auditEvent.findMany({
            where: auditScope.all
              ? {}
              : { organizationId: { in: [...auditScope.organizationIds] } },
            orderBy: { sequence: "desc" },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    const activeEngagements =
      projectIds.length === 0
        ? 0
        : await this.prisma.engagement.count({
            where: {
              status: "active",
              projects: { some: { projectId: { in: projectIds.map((p) => p.id) } } },
            },
          });

    const actorIds = [...new Set(recent.map((r) => r.actorUserId).filter((v): v is string => !!v))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, displayName: true },
    });
    const names = new Map(actors.map((a) => [a.id, a.displayName]));

    return {
      organizationsByKind: byKind.map((k) => ({ kind: k.kind, count: k._count._all })),
      activeProjects,
      activeEngagements,
      recentActivity: recent.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actorDisplayName: r.actorUserId ? (names.get(r.actorUserId) ?? null) : null,
      })),
    };
  }
}
