import { Controller, Get, Injectable, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PERMISSIONS } from "@ems/domain";
import type { Prisma } from "@ems/db";
import { CurrentPrincipal, RequirePermission } from "../auth/decorators";
import type { AuthenticatedPrincipal } from "../auth/principal.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { PageMetaDto, PaginationQueryDto, ProblemDto } from "../common/dto";
import { notFound } from "../common/problem";
import { PrismaService } from "../prisma/prisma.service";

const PROJECT_STATUSES = ["proposed", "active", "on_hold", "completed", "cancelled"] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export class ListProjectsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: PROJECT_STATUSES })
  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;
}

export class OrganizationRefDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty() name: string;
}

export class EngagementRefDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() commercialModel: string;
  @ApiProperty() status: string;
}

export class ProjectDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ enum: PROJECT_STATUSES }) status: ProjectStatus;
  @ApiProperty({ type: String, nullable: true }) equipmentType: string | null;
  @ApiProperty({ type: String, nullable: true }) siteLocation: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date" }) startDate: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date" }) targetCompletionDate:
    string | null;
  @ApiProperty({ type: OrganizationRefDto }) organization: OrganizationRefDto;
  @ApiProperty({ type: [EngagementRefDto], description: "EMS engagements covering this project" })
  engagements: EngagementRefDto[];
  @ApiProperty() version: number;
}

export class ProjectPageDto {
  @ApiProperty({ type: [ProjectDto] }) data: ProjectDto[];
  @ApiProperty({ type: PageMetaDto }) meta: PageMetaDto;
}

export class ProjectMemberDto {
  @ApiProperty({ format: "uuid" }) userId: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ enum: ["internal", "customer", "service"] }) userType: string;
  @ApiProperty() roleKey: string;
  @ApiProperty() roleName: string;
  @ApiProperty({ format: "date-time" }) addedAt: string;
}

const projectInclude = {
  organization: { select: { id: true, name: true } },
  engagements: {
    include: {
      engagement: { select: { id: true, name: true, commercialModel: true, status: true } },
    },
  },
} satisfies Prisma.ProjectInclude;

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function toProjectDto(p: ProjectRow): ProjectDto {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    status: p.status,
    equipmentType: p.equipmentType,
    siteLocation: p.siteLocation,
    startDate: dateOnly(p.startDate),
    targetCompletionDate: dateOnly(p.targetCompletionDate),
    organization: p.organization,
    engagements: p.engagements.map((ep) => ep.engagement),
    version: p.version,
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  /** Project visibility: global grant, organization-level grant, or explicit project membership. */
  readableWhere(principal: AuthenticatedPrincipal): Prisma.ProjectWhereInput | null {
    const scope = this.authz.scope(principal, PERMISSIONS.PROJECT_READ);
    if (scope.all) return {};
    const or: Prisma.ProjectWhereInput[] = [];
    if (scope.organizationIds.length)
      or.push({ organizationId: { in: [...scope.organizationIds] } });
    if (scope.projectIds.length) or.push({ id: { in: [...scope.projectIds] } });
    return or.length ? { OR: or } : null;
  }

  async list(principal: AuthenticatedPrincipal, q: ListProjectsQueryDto): Promise<ProjectPageDto> {
    const tenant = this.readableWhere(principal);
    if (!tenant) return { data: [], meta: { page: q.page, pageSize: q.pageSize, total: 0 } };
    const where: Prisma.ProjectWhereInput = {
      AND: [
        tenant,
        q.status ? { status: q.status } : {},
        q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" } },
                { code: { contains: q.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include: projectInclude,
        orderBy: [{ code: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { data: rows.map(toProjectDto), meta: { page: q.page, pageSize: q.pageSize, total } };
  }

  private async loadAuthorized(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: projectInclude,
    });
    if (
      !project ||
      !this.authz.check(principal, PERMISSIONS.PROJECT_READ, {
        organizationId: project.organizationId,
        projectId: project.id,
      }).allowed
    ) {
      throw notFound("Project");
    }
    return project;
  }

  async get(principal: AuthenticatedPrincipal, id: string): Promise<ProjectDto> {
    return toProjectDto(await this.loadAuthorized(principal, id));
  }

  async members(principal: AuthenticatedPrincipal, id: string): Promise<ProjectMemberDto[]> {
    await this.loadAuthorized(principal, id);
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId: id, removedAt: null },
      include: {
        user: { select: { id: true, displayName: true, userType: true } },
        role: { select: { key: true, name: true } },
      },
      orderBy: { addedAt: "asc" },
    });
    return rows.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      userType: m.user.userType,
      roleKey: m.role.key,
      roleName: m.role.name,
      addedAt: m.addedAt.toISOString(),
    }));
  }
}

@ApiTags("projects")
@ApiBearerAuth()
@Controller({ path: "projects", version: "1" })
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({
    operationId: "listProjects",
    summary: "List customer equipment projects visible to the caller",
  })
  @ApiOkResponse({ type: ProjectPageDto })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() q: ListProjectsQueryDto) {
    return this.projects.list(principal, q);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ operationId: "getProject", summary: "Get a project" })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse({ type: ProblemDto })
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.projects.get(principal, id);
  }

  @Get(":id/members")
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ operationId: "listProjectMembers", summary: "List active project members" })
  @ApiOkResponse({ type: [ProjectMemberDto] })
  @ApiNotFoundResponse({ type: ProblemDto })
  members(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.projects.members(principal, id);
  }
}
