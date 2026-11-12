import { collect, type RuleResult, type RuleViolation } from "../common/result";
import { PERMISSIONS, type PermissionKey } from "../authorization/permissions";
import type { UserType } from "../authorization/roles";

/**
 * Approval levels.
 *  0 - Autonomous low-risk internal operation (no human approval record required).
 *  1 - EMS internal authorization.
 *  2 - Customer commercial authorization.
 *  3 - Customer technical/safety authorization.
 */
export const APPROVAL_LEVELS = [0, 1, 2, 3] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

export type ApprovingParty = "none" | "ems" | "customer";

export interface ApprovalPurposeDefinition {
  readonly purpose: string;
  readonly level: ApprovalLevel;
  readonly party: ApprovingParty;
  /** Permission the approver must hold on the subject's scope. */
  readonly permission: PermissionKey | null;
  /** Whether supporting evidence (e.g. signed document, remittance) must be attached. */
  readonly evidenceRequired: boolean;
  /** Whether the approval target is a document revision or a baseline. */
  readonly target: "document_revision" | "baseline" | "none";
  readonly description: string;
}

const P = PERMISSIONS;

export const APPROVAL_PURPOSES = {
  internal_record_update: {
    purpose: "internal_record_update",
    level: 0,
    party: "none",
    permission: null,
    evidenceRequired: false,
    target: "none",
    description: "Low-risk internal data hygiene (e.g. enrich CRM fields, draft notes).",
  },
  outbound_communication: {
    purpose: "outbound_communication",
    level: 1,
    party: "ems",
    permission: P.APPROVAL_EMS_INTERNAL,
    evidenceRequired: false,
    target: "document_revision",
    description: "Any message leaving EMS (email, proposal transmittal, customer update).",
  },
  proposal_release: {
    purpose: "proposal_release",
    level: 1,
    party: "ems",
    permission: P.APPROVAL_EMS_INTERNAL,
    evidenceRequired: false,
    target: "document_revision",
    description: "Release a proposal revision to the customer.",
  },
  contract_execution_ems: {
    purpose: "contract_execution_ems",
    level: 1,
    party: "ems",
    permission: P.APPROVAL_EMS_INTERNAL,
    evidenceRequired: true,
    target: "document_revision",
    description: "EMS signatory executes a contract revision (signed copy required).",
  },
  invoice_release: {
    purpose: "invoice_release",
    level: 1,
    party: "ems",
    permission: P.APPROVAL_EMS_INTERNAL,
    evidenceRequired: false,
    target: "document_revision",
    description: "Release an invoice revision to the customer.",
  },
  payment_verification: {
    purpose: "payment_verification",
    level: 1,
    party: "ems",
    permission: P.PAYMENT_VERIFY,
    evidenceRequired: true,
    target: "document_revision",
    description: "Mark a payment verified against remittance/bank evidence.",
  },
  contract_execution_customer: {
    purpose: "contract_execution_customer",
    level: 2,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_COMMERCIAL,
    evidenceRequired: true,
    target: "document_revision",
    description: "Customer countersignature of a contract revision.",
  },
  change_request_commercial: {
    purpose: "change_request_commercial",
    level: 2,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_COMMERCIAL,
    evidenceRequired: false,
    target: "document_revision",
    description: "Customer approval of a change request's cost/schedule impact.",
  },
  baseline_approval: {
    purpose: "baseline_approval",
    level: 2,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_COMMERCIAL,
    evidenceRequired: false,
    target: "baseline",
    description: "Customer approval of a scope/schedule/cost baseline revision.",
  },
  gate_passage_commercial: {
    purpose: "gate_passage_commercial",
    level: 2,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_COMMERCIAL,
    evidenceRequired: false,
    target: "document_revision",
    description: "Customer commercial approval to pass a stage gate (gate package revision).",
  },
  deliverable_acceptance: {
    purpose: "deliverable_acceptance",
    level: 2,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_COMMERCIAL,
    evidenceRequired: false,
    target: "document_revision",
    description: "Customer acceptance of a deliverable revision.",
  },
  closeout_acceptance: {
    purpose: "closeout_acceptance",
    level: 2,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_COMMERCIAL,
    evidenceRequired: true,
    target: "document_revision",
    description: "Customer acceptance of contractual closeout.",
  },
  gate_passage_technical: {
    purpose: "gate_passage_technical",
    level: 3,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_TECHNICAL,
    evidenceRequired: true,
    target: "document_revision",
    description: "Customer technical approval to pass a technical gate (e.g. FAT/SAT).",
  },
  technical_release: {
    purpose: "technical_release",
    level: 3,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_TECHNICAL,
    evidenceRequired: true,
    target: "document_revision",
    description: "Customer technical release (e.g. design freeze, release to build).",
  },
  safety_release: {
    purpose: "safety_release",
    level: 3,
    party: "customer",
    permission: P.APPROVAL_CUSTOMER_TECHNICAL,
    evidenceRequired: true,
    target: "document_revision",
    description: "Customer safety release (e.g. risk assessment sign-off, energization).",
  },
} as const satisfies Record<string, ApprovalPurposeDefinition>;

export type ApprovalPurpose = keyof typeof APPROVAL_PURPOSES;

export function getApprovalPurpose(purpose: string): ApprovalPurposeDefinition | undefined {
  return (APPROVAL_PURPOSES as Record<string, ApprovalPurposeDefinition>)[purpose];
}

export type ActorType = "user" | "agent" | "system" | "workflow";

export type ApprovalViolationCode =
  | "UNKNOWN_PURPOSE"
  | "LEVEL_ZERO_NOT_RECORDED"
  | "NON_HUMAN_APPROVER"
  | "APPROVER_INACTIVE"
  | "MFA_REQUIRED"
  | "WRONG_PARTY"
  | "TENANT_MISMATCH"
  | "NO_AUTHORITY"
  | "SELF_APPROVAL"
  | "TARGET_MISSING"
  | "TARGET_MISMATCH"
  | "STALE_REVISION"
  | "CONTENT_HASH_MISMATCH"
  | "EVIDENCE_REQUIRED"
  | "CLIENT_TIMESTAMP_REJECTED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "ALREADY_DECIDED";

export interface ApprovalTargetState {
  readonly kind: "document_revision" | "baseline";
  readonly id: string;
  /** SHA-256 of the immutable content, as stored server-side. */
  readonly contentSha256: string;
  /** Whether this revision is the current (latest, non-superseded) revision of its parent. */
  readonly isCurrent: boolean;
  /** User who authored the revision (for segregation of duties). */
  readonly authorUserId: string | null;
  /** Customer organization that owns the subject. */
  readonly organizationId: string;
}

export interface ApprovalRequest {
  readonly purpose: string;
  readonly targetKind: "document_revision" | "baseline";
  readonly targetId: string;
  /** The hash the approver saw and is approving. Must match the server's stored hash. */
  readonly reviewedContentSha256: string;
  readonly evidenceDocumentRevisionId?: string | null;
  readonly idempotencyKey?: string | null;
  /** Any client-supplied decision time is rejected; decision time is the server clock. */
  readonly clientDecidedAt?: string | null;
}

export interface ApproverState {
  readonly actorType: ActorType;
  readonly userId: string | null;
  readonly userType: UserType | null;
  readonly status: "invited" | "active" | "suspended" | "deactivated" | null;
  readonly homeOrganizationId: string | null;
  readonly mfaSatisfied: boolean;
  /** Result of authorization policy evaluation for the purpose's permission on the subject. */
  readonly hasPermission: boolean;
}

export interface ApprovalValidationInput {
  readonly request: ApprovalRequest;
  readonly approver: ApproverState;
  readonly target: ApprovalTargetState | null;
  /** True if a final decision already exists from this approver for this purpose and target. */
  readonly alreadyDecided: boolean;
}

const v = (code: ApprovalViolationCode, message: string): RuleViolation<ApprovalViolationCode> => ({
  code,
  message,
});

/**
 * Validates that an approval decision may be recorded. A workflow event or agent output is never
 * sufficient: identity, authority, evidence and exact revision are all checked here.
 */
export function validateApprovalDecision(
  input: ApprovalValidationInput,
): RuleResult<ApprovalViolationCode> {
  const { request, approver, target } = input;
  const def = getApprovalPurpose(request.purpose);
  if (!def)
    return collect([v("UNKNOWN_PURPOSE", `Unknown approval purpose '${request.purpose}'.`)]);
  if (def.level === 0) {
    return collect([
      v("LEVEL_ZERO_NOT_RECORDED", "Level 0 operations do not create approval records."),
    ]);
  }

  const violations: (RuleViolation<ApprovalViolationCode> | false)[] = [];

  if (approver.actorType !== "user" || !approver.userId || approver.userType === "service") {
    violations.push(
      v("NON_HUMAN_APPROVER", "Approvals can only be recorded by an authenticated human user."),
    );
  }
  violations.push(
    approver.status !== "active" && v("APPROVER_INACTIVE", "Approver account is not active."),
    !approver.mfaSatisfied &&
      v("MFA_REQUIRED", "Approvals require a multi-factor authenticated session."),
  );

  if (def.party === "ems" && approver.userType !== "internal") {
    violations.push(v("WRONG_PARTY", "This approval must be given by an EMS internal user."));
  }
  if (def.party === "customer" && approver.userType !== "customer") {
    violations.push(
      v("WRONG_PARTY", "This approval must be given by an authorized customer user."),
    );
  }

  violations.push(
    !approver.hasPermission &&
      v("NO_AUTHORITY", "Approver does not hold the required authority for this subject."),
    !request.idempotencyKey &&
      v("IDEMPOTENCY_KEY_REQUIRED", "Approval requests must carry an idempotency key."),
    Boolean(request.clientDecidedAt) &&
      v(
        "CLIENT_TIMESTAMP_REJECTED",
        "Decision time is assigned by the server; client-supplied timestamps are not accepted.",
      ),
    def.evidenceRequired &&
      !request.evidenceDocumentRevisionId &&
      v("EVIDENCE_REQUIRED", "This approval requires an attached evidence document revision."),
    input.alreadyDecided &&
      v("ALREADY_DECIDED", "A decision has already been recorded for this target."),
  );

  if (!target) {
    violations.push(v("TARGET_MISSING", "Approval target revision does not exist."));
  } else {
    if (
      target.kind !== request.targetKind ||
      target.kind !== def.target ||
      target.id !== request.targetId
    ) {
      violations.push(v("TARGET_MISMATCH", "Approval target does not match the purpose."));
    }
    if (!target.isCurrent) {
      violations.push(v("STALE_REVISION", "Only the current revision can be approved."));
    }
    if (target.contentSha256 !== request.reviewedContentSha256) {
      violations.push(
        v("CONTENT_HASH_MISMATCH", "Reviewed content does not match the stored revision."),
      );
    }
    if (
      def.party === "customer" &&
      approver.homeOrganizationId !== null &&
      approver.homeOrganizationId !== target.organizationId
    ) {
      violations.push(v("TENANT_MISMATCH", "Approver belongs to a different organization."));
    }
    if (target.authorUserId !== null && target.authorUserId === approver.userId) {
      violations.push(v("SELF_APPROVAL", "Authors cannot approve their own revisions."));
    }
  }

  return collect(violations);
}
