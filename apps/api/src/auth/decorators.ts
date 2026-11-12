import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { PermissionKey } from "@ems/domain";
import type { AuthenticatedPrincipal } from "./principal.service";

export const IS_PUBLIC = "ems:isPublic";
export const REQUIRED_PERMISSION = "ems:requiredPermission";
export const AUTHENTICATED_ONLY = "ems:authenticatedOnly";

/** Marks a route as reachable without authentication (health checks only). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Declares the permission a route requires. The guard checks that the principal holds it in some
 * scope; services then enforce it against the specific resource. Routes without this decorator,
 * @AuthenticatedOnly or @Public are denied.
 */
export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRED_PERMISSION, permission);

/** For self-service routes (e.g. /me) that any active, provisioned user may call. */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY, true);

export const CurrentPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedPrincipal => {
    const req = ctx.switchToHttp().getRequest<{ principal?: AuthenticatedPrincipal }>();
    if (!req.principal) throw new Error("CurrentPrincipal used on an unauthenticated route");
    return req.principal;
  },
);
