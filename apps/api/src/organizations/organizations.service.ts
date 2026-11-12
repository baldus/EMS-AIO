import { HttpStatus, Injectable } from "@nestjs/common";
import {
  normalizeOrganizationName,
  PERMISSIONS,
  requiresArchivePermission,
  validateOrganizationCreate,
  validateOrganizationUpdate,
  type OrganizationStatus,
} from "@ems/domain";
import type { Organization, Prisma } from "@ems/db";
import type { AuthenticatedPrincipal } from "../auth/principal.service";
import { AuditService, diffForAudit } from "../audit/audit.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { ProblemException, notFound, ruleViolation, versionConflict } from "../common/problem";
import type { RequestMeta } from "../common/request-meta";
import { IdempotencyService, type IdempotentResult } from "../idempotency/idempotency.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  OrganizationDto,
  OrganizationPageDto,
  UpdateOrganizationDto,
} from "./organization.dto";

export function toOrganizationDto(o: Organization): OrganizationDto {
  return {
    id: o.id,
    name: o.name,
    legalName: o.legalName,
    kind: o.kind,
    status: o.status,
    segment: o.segment,
    industry: o.industry,
    website: o.website,
    phone: o.phone,
    addressLine1: o.addressLine1,
    addressLine2: o.addressLine2,
    city: o.city,
    region: o.region,
    postalCode: o.postalCode,
    countryCode: o.countryCode,
    notes: o.notes,
    ownerUserId: o.ownerUserId,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    archivedAt: o.archivedAt?.toISOString() ?? null,
    version: o.version,
  };
}

const P = PERMISSIONS;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /** Builds the tenant filter for organizations the principal may read. */
  private readableWhere(principal: AuthenticatedPrincipal): Prisma.OrganizationWhereInput | null {
    const scope = this.authz.scope(principal, P.ORGANIZATION_READ);
    if (scope.all) return {};
    const ids = [...new Set([...scope.organizationIds, ...scope.organizationIdsViaProjects])];
    return ids.length > 0 ? { id: { in: ids } } : null;
  }

  async list(
    principal: AuthenticatedPrincipal,
    q: ListOrganizationsQueryDto,
  ): Promise<OrganizationPageDto> {
    const tenant = this.readableWhere(principal);
    if (tenant === null)
      return { data: [], meta: { page: q.page, pageSize: q.pageSize, total: 0 } };

    const where: Prisma.OrganizationWhereInput = {
      AND: [
        tenant,
        q.search ? { name: { contains: q.search, mode: "insensitive" } } : {},
        q.kind ? { kind: q.kind } : {},
        q.status ? { status: q.status } : q.includeArchived ? {} : { status: { not: "archived" } },
      ],
    };
    const sort = q.sort ?? "name";
    const [total, rows] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: [{ [sort]: q.order ?? "asc" }, { id: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      data: rows.map(toOrganizationDto),
      meta: { page: q.page, pageSize: q.pageSize, total },
    };
  }

  /** Returns 404 both for missing and for unauthorized records to avoid leaking existence. */
  async get(principal: AuthenticatedPrincipal, id: string): Promise<OrganizationDto> {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org || !this.authz.check(principal, P.ORGANIZATION_READ, { organizationId: id }).allowed) {
      throw notFound("Organization");
    }
    return toOrganizationDto(org);
  }

  private async assertValidOwner(
    tx: Prisma.TransactionClient,
    ownerUserId: string | null | undefined,
  ) {
    if (!ownerUserId) return;
    const owner = await tx.user.findUnique({ where: { id: ownerUserId } });
    if (!owner || owner.userType !== "internal" || !["active", "invited"].includes(owner.status)) {
      throw ruleViolation([
        { code: "INVALID_OWNER", message: "Owner must be an active or invited EMS internal user." },
      ]);
    }
  }

  async create(
    principal: AuthenticatedPrincipal,
    dto: CreateOrganizationDto,
    meta: RequestMeta,
    idempotencyKey: string | undefined,
  ): Promise<IdempotentResult<OrganizationDto>> {
    this.authz.assert(principal, P.ORGANIZATION_CREATE, {});
    const name = normalizeOrganizationName(dto.name);
    const rules = validateOrganizationCreate({ name, kind: dto.kind });
    if (!rules.ok) throw ruleViolation(rules.errors);

    return this.idempotency.run(
      {
        userId: principal.userId,
        key: idempotencyKey,
        operation: "organization.create",
        request: dto,
        status: HttpStatus.CREATED,
      },
      async (tx) => {
        await this.assertValidOwner(tx, dto.ownerUserId);
        const org = await tx.organization.create({
          data: {
            ...dto,
            name,
            createdById: principal.userId,
            updatedById: principal.userId,
          },
        });
        const out = toOrganizationDto(org);
        await this.audit.recordUserAction(tx, {
          actorUserId: principal.userId,
          organizationId: org.id,
          action: "organization.created",
          entityType: "organization",
          entityId: org.id,
          after: out,
          meta,
        });
        return out;
      },
    );
  }

  async update(
    principal: AuthenticatedPrincipal,
    id: string,
    dto: UpdateOrganizationDto,
    meta: RequestMeta,
  ): Promise<OrganizationDto> {
    const { version, ...changes } = dto;
    if (changes.name !== undefined) changes.name = normalizeOrganizationName(changes.name);
    return this.mutate(principal, id, version, meta, "organization.updated", changes);
  }

  archive(principal: AuthenticatedPrincipal, id: string, version: number, meta: RequestMeta) {
    return this.mutate(principal, id, version, meta, "organization.archived", {
      status: "archived",
    });
  }

  restore(principal: AuthenticatedPrincipal, id: string, version: number, meta: RequestMeta) {
    return this.mutate(principal, id, version, meta, "organization.restored", { status: "active" });
  }

  private async mutate(
    principal: AuthenticatedPrincipal,
    id: string,
    expectedVersion: number,
    meta: RequestMeta,
    action: string,
    changes: Omit<UpdateOrganizationDto, "version" | "status"> & { status?: OrganizationStatus },
  ): Promise<OrganizationDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.organization.findUnique({ where: { id } });
      // Readers who may not update get 403; non-readers get 404 (no existence leak).
      if (
        !current ||
        !this.authz.check(principal, P.ORGANIZATION_READ, { organizationId: id }).allowed
      ) {
        throw notFound("Organization");
      }
      this.authz.assert(principal, P.ORGANIZATION_UPDATE, { organizationId: id });
      if (requiresArchivePermission(current.status, changes.status)) {
        this.authz.assert(principal, P.ORGANIZATION_ARCHIVE, { organizationId: id });
      }
      if (current.version !== expectedVersion) throw versionConflict();

      const rules = validateOrganizationUpdate({
        current: { kind: current.kind, status: current.status },
        next: { name: changes.name, kind: changes.kind, status: changes.status },
        otherFieldsChanged: Object.entries(changes).some(
          ([k, v]) => v !== undefined && !["name", "kind", "status"].includes(k),
        ),
      });
      if (!rules.ok) throw ruleViolation(rules.errors);
      await this.assertValidOwner(tx, changes.ownerUserId);

      const archivedAt =
        changes.status === "archived"
          ? new Date()
          : changes.status !== undefined
            ? null
            : undefined;
      const result = await tx.organization.updateMany({
        where: { id, version: expectedVersion },
        data: {
          ...changes,
          ...(archivedAt !== undefined ? { archivedAt } : {}),
          updatedById: principal.userId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw versionConflict();

      const updated = await tx.organization.findUniqueOrThrow({ where: { id } });
      const before = toOrganizationDto(current);
      const after = toOrganizationDto(updated);
      const diff = diffForAudit(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      );
      if (Object.keys(diff.after).length === 0) {
        throw new ProblemException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "NO_CHANGES",
          "The request changes nothing.",
        );
      }
      await this.audit.recordUserAction(tx, {
        actorUserId: principal.userId,
        organizationId: id,
        action,
        entityType: "organization",
        entityId: id,
        before: diff.before,
        after: diff.after,
        metadata: { version: updated.version },
        meta,
      });
      return after;
    });
  }
}
