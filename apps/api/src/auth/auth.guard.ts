import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { effectivePermissionKeys, PERMISSION_DEFINITIONS, type PermissionKey } from "@ems/domain";
import type { Request } from "express";
import { ProblemException, forbidden } from "../common/problem";
import { requestMetaFrom } from "../common/request-meta";
import { AUTHENTICATED_ONLY, IS_PUBLIC, REQUIRED_PERMISSION } from "./decorators";
import { PrincipalService, type AuthenticatedPrincipal } from "./principal.service";
import { TokenVerificationError, TokenVerifierService } from "./token-verifier.service";

const unauthenticated = (detail: string) =>
  new ProblemException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", detail);

/**
 * Global, default-deny guard: authenticates the bearer token, resolves the principal, and requires
 * every non-public route to declare an authorization policy.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifierService,
    private readonly principals: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const permission = this.reflector.getAllAndOverride<PermissionKey | undefined>(
      REQUIRED_PERMISSION,
      targets,
    );
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      AUTHENTICATED_ONLY,
      targets,
    );
    if (!permission && !authenticatedOnly) {
      // A route without a declared policy is a programming error; deny rather than allow.
      throw forbidden("NO_POLICY", "This endpoint has no authorization policy.");
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { principal?: AuthenticatedPrincipal }>();
    const header = req.get("authorization");
    const match = header?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/);
    if (!match) {
      throw unauthenticated("A bearer access token is required.");
    }

    let token;
    try {
      token = await this.verifier.verify(match[1]!);
    } catch (err) {
      if (err instanceof TokenVerificationError) throw unauthenticated(err.message);
      throw err;
    }
    const principal = await this.principals.resolve(token, requestMetaFrom(req));
    req.principal = principal;

    if (permission) {
      if (!PERMISSION_DEFINITIONS[permission]) throw forbidden("NO_POLICY", "Unknown permission.");
      if (!effectivePermissionKeys(principal).includes(permission)) {
        const blockedByMfa =
          !principal.mfaSatisfied && principal.grants.some((g) => g.permissions.has(permission));
        throw blockedByMfa
          ? forbidden("MFA_REQUIRED", "This action requires a multi-factor authenticated session.")
          : forbidden("FORBIDDEN", "You do not have permission to perform this action.");
      }
    }
    return true;
  }
}
