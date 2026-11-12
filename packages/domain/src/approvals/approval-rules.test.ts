import { describe, expect, it } from "vitest";
import {
  APPROVAL_PURPOSES,
  validateApprovalDecision,
  type ApprovalValidationInput,
  type ApprovalViolationCode,
} from "./approval-rules";

const CUST_A = "org-a";
const HASH = "a".repeat(64);

function base(overrides: Partial<ApprovalValidationInput> = {}): ApprovalValidationInput {
  return {
    request: {
      purpose: "change_request_commercial",
      targetKind: "document_revision",
      targetId: "rev-1",
      reviewedContentSha256: HASH,
      idempotencyKey: "idem-1",
    },
    approver: {
      actorType: "user",
      userId: "cust-user-1",
      userType: "customer",
      status: "active",
      homeOrganizationId: CUST_A,
      mfaSatisfied: true,
      hasPermission: true,
    },
    target: {
      kind: "document_revision",
      id: "rev-1",
      contentSha256: HASH,
      isCurrent: true,
      authorUserId: "ems-pm-1",
      organizationId: CUST_A,
    },
    alreadyDecided: false,
    ...overrides,
  };
}

function codes(input: ApprovalValidationInput): ApprovalViolationCode[] {
  const r = validateApprovalDecision(input);
  return r.ok ? [] : r.errors.map((e) => e.code);
}

describe("validateApprovalDecision", () => {
  it("accepts a valid customer commercial approval", () => {
    expect(validateApprovalDecision(base())).toEqual({ ok: true });
  });

  it.each(["agent", "system", "workflow"] as const)(
    "rejects %s actors as approvers",
    (actorType) => {
      expect(codes(base({ approver: { ...base().approver, actorType } }))).toContain(
        "NON_HUMAN_APPROVER",
      );
    },
  );

  it("rejects service accounts as approvers", () => {
    expect(codes(base({ approver: { ...base().approver, userType: "service" } }))).toContain(
      "NON_HUMAN_APPROVER",
    );
  });

  it("requires MFA", () => {
    expect(codes(base({ approver: { ...base().approver, mfaSatisfied: false } }))).toContain(
      "MFA_REQUIRED",
    );
  });

  it("rejects approval of a different revision than the one reviewed", () => {
    expect(
      codes(base({ request: { ...base().request, reviewedContentSha256: "b".repeat(64) } })),
    ).toContain("CONTENT_HASH_MISMATCH");
  });

  it("rejects approval of a superseded revision", () => {
    expect(codes(base({ target: { ...base().target!, isCurrent: false } }))).toContain(
      "STALE_REVISION",
    );
  });

  it("rejects client-supplied decision timestamps (no backdating)", () => {
    expect(
      codes(base({ request: { ...base().request, clientDecidedAt: "2020-01-01T00:00:00Z" } })),
    ).toContain("CLIENT_TIMESTAMP_REJECTED");
  });

  it("rejects EMS users giving customer approvals", () => {
    expect(
      codes(
        base({ approver: { ...base().approver, userType: "internal", homeOrganizationId: "ems" } }),
      ),
    ).toContain("WRONG_PARTY");
  });

  it("rejects customer users approving on behalf of another tenant", () => {
    expect(
      codes(base({ approver: { ...base().approver, homeOrganizationId: "org-b" } })),
    ).toContain("TENANT_MISMATCH");
  });

  it("rejects self-approval", () => {
    expect(codes(base({ target: { ...base().target!, authorUserId: "cust-user-1" } }))).toContain(
      "SELF_APPROVAL",
    );
  });

  it("requires evidence for evidence-bearing purposes", () => {
    const input = base({ request: { ...base().request, purpose: "safety_release" } });
    expect(codes(input)).toContain("EVIDENCE_REQUIRED");
    expect(
      codes({
        ...input,
        request: { ...input.request, evidenceDocumentRevisionId: "evidence-rev" },
      }),
    ).toEqual([]);
  });

  it("requires authority and an idempotency key", () => {
    const c = codes(
      base({
        approver: { ...base().approver, hasPermission: false },
        request: { ...base().request, idempotencyKey: null },
      }),
    );
    expect(c).toEqual(expect.arrayContaining(["NO_AUTHORITY", "IDEMPOTENCY_KEY_REQUIRED"]));
  });

  it("rejects baseline purposes targeting documents", () => {
    expect(codes(base({ request: { ...base().request, purpose: "baseline_approval" } }))).toContain(
      "TARGET_MISMATCH",
    );
  });

  it("does not record level 0 approvals", () => {
    expect(
      codes(base({ request: { ...base().request, purpose: "internal_record_update" } })),
    ).toEqual(["LEVEL_ZERO_NOT_RECORDED"]);
  });

  it("maps every technical/safety purpose to level 3 and customer party", () => {
    for (const key of ["technical_release", "safety_release", "gate_passage_technical"] as const) {
      expect(APPROVAL_PURPOSES[key]).toMatchObject({ level: 3, party: "customer" });
    }
  });
});
