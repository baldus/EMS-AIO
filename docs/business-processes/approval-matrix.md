# Approval Matrix

Code source of truth: `APPROVAL_PURPOSES` in
[`packages/domain/src/approvals/approval-rules.ts`](../../packages/domain/src/approvals/approval-rules.ts).

## Levels

| Level | Meaning | Who | Record created? |
|---|---|---|---|
| **0** | Autonomous low-risk internal operation | System, workflows, AI agents (if granted) | No approval record; audit event only |
| **1** | EMS internal authorization | EMS internal users holding the purpose's permission (MFA) | Yes |
| **2** | Customer commercial authorization | Customer users with commercial approver authority on the project/org (MFA) | Yes |
| **3** | Customer technical/safety authorization | Customer users with technical/safety approver authority (MFA) | Yes |

Levels are not cumulative shortcuts: a Level 3 approver does not automatically satisfy a Level 2
requirement unless they also hold the Level 2 authority.

## Purposes

| Purpose | Level | Party | Required permission | Target | Evidence required |
|---|---|---|---|---|---|
| `internal_record_update` | 0 | — | — | — | — |
| `outbound_communication` | 1 | EMS | `approval:ems_internal` | document revision (the message) | No |
| `proposal_release` | 1 | EMS | `approval:ems_internal` | proposal revision | No |
| `contract_execution_ems` | 1 | EMS | `approval:ems_internal` | contract revision | **Signed copy** |
| `invoice_release` | 1 | EMS | `approval:ems_internal` | invoice revision | No |
| `payment_verification` | 1 | EMS | `payment:verify` | remittance document revision | **Remittance/bank record** |
| `contract_execution_customer` | 2 | Customer | `approval:customer_commercial` | contract revision | **Countersigned copy** |
| `change_request_commercial` | 2 | Customer | `approval:customer_commercial` | CR revision | No |
| `baseline_approval` | 2 | Customer | `approval:customer_commercial` | baseline | No |
| `gate_passage_commercial` | 2 | Customer | `approval:customer_commercial` | gate package revision | No |
| `deliverable_acceptance` | 2 | Customer | `approval:customer_commercial` | deliverable revision | No |
| `closeout_acceptance` | 2 | Customer | `approval:customer_commercial` | closeout revision | **Signed acceptance** |
| `gate_passage_technical` | 3 | Customer | `approval:customer_technical` | gate package revision | **Test/inspection results** |
| `technical_release` | 3 | Customer | `approval:customer_technical` | design/release revision | **Review record** |
| `safety_release` | 3 | Customer | `approval:customer_technical` | risk assessment / validation revision | **Safety validation** |

## Rules applied to every approval (levels 1–3)

Validated by `validateApprovalDecision` (domain) and, where noted, by the database.

1. **Human only** — `actor_type=user`, not a service account (DB trigger: active non-service user).
   Agents, workflows, and the system can never approve.
2. **Active account + MFA session** (DB CHECK `mfa_verified`).
3. **Right party** — EMS purposes need an internal user; customer purposes need a customer user
   **from the subject's organization**.
4. **Authority** — approver holds the purpose's permission on the subject's project/organization.
5. **Segregation of duties** — the author of the revision cannot approve it.
6. **Exact revision** — target must be the *current* revision, and the hash the approver reviewed
   must equal the stored hash (DB trigger re-checks).
7. **Evidence** — attached as an immutable document revision where required.
8. **No backdating** — client-supplied timestamps are rejected; DB sets `decided_at := now()`.
9. **Idempotency key** required; duplicate submissions return the original decision.
10. **One decision** per approver/purpose/target; changing one's mind is a **revocation** row.
11. **Immutability** — approvals are append-only; downstream state (baseline approved, gate passed,
    contract executed, payment verified) is only set by services that find a valid, unrevoked
    approval with a matching hash.

## Things no AI agent may ever do

Sign contracts · approve customer expenditures · approve technical or safety releases · alter
approved baselines · mark invoices paid without verified evidence · declare customer acceptance ·
fabricate or backdate approval records · send external communications without Level 1 approval.

## Delegation of authority (to be defined — open question Q7)

EMS should define value thresholds (e.g. contracts above $X require two Level 1 approvers, one of
them an EMS principal). The model supports this by adding purpose variants or a `min_approvers`
rule per purpose; it will be implemented with the contracts module (R2).
