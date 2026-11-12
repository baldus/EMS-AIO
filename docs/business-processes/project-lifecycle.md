# Project Lifecycle

EMS sells **engagements** (its paid services) to customers who run **equipment projects** (the
machine, cell, or line being built). The platform keeps them separate: an engagement can complete
while the customer's project continues, and one project can be served by several engagements
(e.g. a fixed-price planning package, then a monthly fractional-PM retainer, then T&M support).

```
Prospecting → Qualification → Proposal → Contract → Onboarding → Execution (gates) → Billing → Closeout
   CRM            CRM           Sales      Sales      Delivery      Governance        Finance   Delivery/Finance
```

## Commercial models

| Model | Typical use | Billing basis |
|---|---|---|
| Fixed-price project planning package | Charter, schedule, risk register, gate plan for a new machine project | Fixed fee, often on milestones (e.g. 50/50) |
| Monthly fractional PM retainer | 10–20 h/week of PM across the customer's projects | Monthly fee; hours tracked for utilization, not billed |
| Milestone-based execution services | PM through build/FAT/SAT | Amount per accepted milestone |
| Time & materials support | Ad-hoc support, punch-list, troubleshooting | Approved hours × rate |

## Stages

### 1. Prospecting and lead research
- **Entities**: `organizations (kind=prospect)`, `contacts`, `activities`.
- **Workflow**: *Lead research & qualification* (Temporal). Lead Intelligence agent enriches the
  profile (level 0 drafts; profile changes at level 1).
- **Exit**: qualified fit → `opportunities (stage=qualified)`.

### 2. Sales development
- Outreach drafts by the Sales Development agent; **every outbound message requires Level 1 human
  approval** of the exact draft revision. Contacts flagged `do_not_contact` are excluded.
- **Exit**: discovery meeting held; needs captured as activities.

### 3. Solution architecture and estimating
- Estimating agent drafts WBS, effort, assumptions, and risks; an EMS manager owns the estimate.
- **Exit**: estimate ready for proposal.

### 4. Proposal
- Proposal document revisions (`documents`/`document_revisions`); *Proposal review* workflow.
- **Gate**: `proposal_release` (Level 1, EMS) on the exact revision → `sent`.
- **Exit**: accepted / rejected / expired.

### 5. Contract
- MSA and SOW/PO (`contracts`, parent/child). *Contract execution* workflow collects
  `contract_execution_ems` (L1) and `contract_execution_customer` (L2), **each with signed-copy
  evidence**, on the same revision hash. Only then is `executed_at` set.
- Opportunity → `won`; organization kind prospect → customer.

### 6. Engagement setup and project onboarding
- Create the **engagement** (commercial model, hours target, fees) under the contract and link it
  to one or more **projects** (`engagement_projects`). Create the project if new.
- *Project onboarding* workflow: project members and roles (EMS PM, customer approvers), gate plan
  from template (G0–G4), initial schedule, risk register, document structure.
- **Exit**: `G0 Charter & Kickoff` approved (L2) and initial **baselines** approved (L2).

### 7. Execution and control
- Tasks, milestones, dependencies; time entries against the engagement.
- *Meeting note processing* workflow: Project Controls agent extracts actions, risks, decisions as
  drafts for the PM to accept.
- Risks → issues; decisions logged.
- **Change management**: change requests with cost/schedule/scope impact → `change_request_commercial`
  (L2) → new baseline revision → `baseline_approval` (L2). Approved baselines are never edited.

### 8. Stage gates

| Gate | Typical evidence | Approval |
|---|---|---|
| G0 Charter & Kickoff | Charter, stakeholder list, gate plan | L2 commercial |
| G1 Design Review | Mechanical/electrical design review package, risk assessment draft | L3 technical |
| G2 Factory Acceptance Test | FAT protocol + results, punch list | L3 technical (+ safety items) |
| G3 Site Acceptance Test | SAT results, safety validation, training records | L3 technical/safety |
| G4 Handover & Closeout | As-builts, manuals, spares list, warranty start | L2 commercial |

*Gate readiness & approval routing* workflow: Gate Compliance agent checks requirements against
evidence and assembles the gate package revision; mandatory requirements must be satisfied (verified
by a human) or waived through an approval; the gate passes only with the required-level approval of
the **exact package revision**.

### 9. Billing and reconciliation
- Retainer: monthly invoice. Milestones: invoice when the milestone is achieved **and accepted**.
  T&M: approved time entries (no self-approval) → invoice lines.
- `invoice_release` (L1) before sending. Payments recorded idempotently; **`verified` only with
  remittance/bank evidence and an internal verifier**. Agents may propose matches, never mark paid.

### 10. Closeout and handover
- **Engagement closeout** (contractual): final invoice, `closeout_acceptance` (L2, with evidence),
  engagement `completed`. The **project may continue**.
- **Project handover** (G4): deliverables accepted (`deliverable_acceptance`, L2), lessons learned,
  documents archived; project `completed` when the customer's project ends.

## Status models (Release 0 schema)

| Entity | States |
|---|---|
| Opportunity | lead → qualified → discovery → proposal → negotiation → won \| lost \| abandoned |
| Proposal | draft → internal_review → approved_for_release → sent → accepted \| rejected \| expired \| withdrawn |
| Contract | draft → internal_review → out_for_signature → executed → active → expired \| terminated \| superseded |
| Engagement | planned → active ⇄ on_hold → completed \| terminated |
| Project | proposed → active ⇄ on_hold → completed \| cancelled |
| Gate | not_started → in_preparation → ready_for_review → approved \| conditionally_approved \| rejected |
| Change request | draft → submitted → under_review → approved \| rejected \| withdrawn → implemented |
| Baseline | draft → submitted → approved \| rejected; approved → superseded |
| Invoice | draft → internal_review → approved_for_release → sent → partially_paid → paid; void; disputed |
| Payment | recorded → verified; reversed |

Transition rules beyond organizations are implemented as domain functions in the release that
introduces each module, following the pattern in `packages/domain/src/organizations`.
