import { Inject, Injectable, Logger } from "@nestjs/common";
import { appendAuditEvent } from "@ems/db";
import type { Grant, Principal } from "@ems/domain";
import { ENV, type Env } from "../config/env";
import { forbidden } from "../common/problem";
import type { RequestMeta } from "../common/request-meta";
import { PrismaService } from "../prisma/prisma.service";
import type { VerifiedAccessToken } from "./token-verifier.service";

export interface AuthenticatedPrincipal extends Principal {
  email: string;
  displayName: string;
}

/**
 * Maps a verified OIDC identity to a platform user and loads the user's grants. Users must be
 * pre-provisioned: an authenticated identity with no platform user is denied (default deny).
 */
@Injectable()
export class PrincipalService {
  private readonly logger = new Logger(PrincipalService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async resolve(token: VerifiedAccessToken, meta: RequestMeta): Promise<AuthenticatedPrincipal> {
    let user = await this.prisma.user.findUnique({
      where: { oidcIssuer_oidcSubject: { oidcIssuer: token.issuer, oidcSubject: token.subject } },
    });

    if (!user) user = await this.linkByVerifiedEmail(token, meta);
    if (!user) {
      throw forbidden(
        "USER_NOT_PROVISIONED",
        "Your account has not been provisioned on this platform.",
      );
    }
    if (user.status !== "active") {
      throw forbidden("USER_INACTIVE", "Your account is not active.");
    }

    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      userType: user.userType,
      status: user.status,
      homeOrganizationId: user.homeOrganizationId,
      mfaSatisfied: token.mfaSatisfied,
      grants: await this.loadGrants(user.id, user.userType),
    };
  }

  /**
   * First-login linking of an invited user to the IdP subject. Only when enabled, only with a
   * verified email claim from the configured issuer, and only for users not yet linked.
   */
  private async linkByVerifiedEmail(token: VerifiedAccessToken, meta: RequestMeta) {
    if (!this.env.AUTH_EMAIL_LINKING_ENABLED || !token.email || !token.emailVerified) return null;
    if (token.issuer !== this.env.OIDC_ISSUER_URL) return null;

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM users
         WHERE lower(email) = lower(${token.email})
           AND oidc_subject IS NULL
           AND status IN ('invited', 'active')
         FOR UPDATE`;
      const candidate = rows[0];
      if (!candidate) return null;
      const linked = await tx.user.update({
        where: { id: candidate.id },
        data: {
          oidcIssuer: token.issuer,
          oidcSubject: token.subject,
          status: "active",
          lastLoginAt: new Date(),
          version: { increment: 1 },
        },
      });
      await appendAuditEvent(tx, {
        actorType: "user",
        actorUserId: linked.id,
        organizationId: linked.homeOrganizationId,
        action: "user.identity_linked",
        entityType: "user",
        entityId: linked.id,
        after: { oidcIssuer: token.issuer, status: linked.status },
        ...meta,
      });
      this.logger.log({ userId: linked.id }, "Linked invited user to OIDC subject");
      return linked;
    });
  }

  private async loadGrants(userId: string, userType: string): Promise<Grant[]> {
    const [assignments, memberships] = await Promise.all([
      this.prisma.roleAssignment.findMany({
        where: { userId, revokedAt: null },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      }),
      this.prisma.projectMember.findMany({
        where: { userId, removedAt: null },
        include: {
          project: { select: { organizationId: true } },
          role: { include: { permissions: { include: { permission: true } } } },
        },
      }),
    ]);

    const grants: Grant[] = [];
    for (const a of assignments) {
      const valid =
        a.role.assignableTo.includes(userType as never) &&
        ((a.role.scope === "global" && a.organizationId === null) ||
          (a.role.scope === "organization" && a.organizationId !== null));
      if (!valid) {
        this.logger.warn({ assignmentId: a.id }, "Ignoring inconsistent role assignment");
        continue;
      }
      const permissions = new Set(a.role.permissions.map((rp) => rp.permission.key));
      grants.push(
        a.organizationId === null
          ? {
              roleKey: a.role.key,
              scope: { type: "global" },
              permissions,
              mfaRequired: a.role.mfaRequired,
            }
          : {
              roleKey: a.role.key,
              scope: { type: "organization", organizationId: a.organizationId },
              permissions,
              mfaRequired: a.role.mfaRequired,
            },
      );
    }
    for (const m of memberships) {
      if (m.role.scope !== "project" || !m.role.assignableTo.includes(userType as never)) {
        this.logger.warn({ membershipId: m.id }, "Ignoring inconsistent project membership");
        continue;
      }
      grants.push({
        roleKey: m.role.key,
        scope: {
          type: "project",
          projectId: m.projectId,
          organizationId: m.project.organizationId,
        },
        permissions: new Set(m.role.permissions.map((rp) => rp.permission.key)),
        mfaRequired: m.role.mfaRequired,
      });
    }
    return grants;
  }
}
