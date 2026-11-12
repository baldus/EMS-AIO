import { Injectable } from "@nestjs/common";
import {
  accessScope,
  evaluate,
  type AccessScope,
  type Decision,
  type PermissionKey,
  type Principal,
  type ResourceContext,
} from "@ems/domain";
import { forbidden } from "../common/problem";

/** Thin adapter over the pure domain policy, translating denials into HTTP problems. */
@Injectable()
export class AuthorizationService {
  check(principal: Principal, permission: PermissionKey, resource: ResourceContext): Decision {
    return evaluate(principal, permission, resource);
  }

  assert(principal: Principal, permission: PermissionKey, resource: ResourceContext): void {
    const decision = evaluate(principal, permission, resource);
    if (decision.allowed) return;
    if (decision.reason === "mfa_required") {
      throw forbidden("MFA_REQUIRED", "This action requires a multi-factor authenticated session.");
    }
    throw forbidden("FORBIDDEN", "You do not have permission to perform this action.");
  }

  scope(principal: Principal, permission: PermissionKey): AccessScope {
    return accessScope(principal, permission);
  }
}
