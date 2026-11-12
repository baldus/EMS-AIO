-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('ems_operator', 'customer', 'prospect', 'partner', 'vendor');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "OrganizationSegment" AS ENUM ('manufacturer', 'custom_machine_builder', 'robotics_integrator', 'automation_company', 'oem', 'other');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('internal', 'customer', 'service');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('global', 'organization', 'project');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('active', 'inactive', 'left_company');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('lead', 'qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost', 'abandoned');

-- CreateEnum
CREATE TYPE "CommercialModel" AS ENUM ('fixed_price_package', 'monthly_retainer', 'milestone_based', 'time_and_materials');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('note', 'call', 'email', 'meeting', 'site_visit', 'task');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('draft', 'internal_review', 'approved_for_release', 'sent', 'accepted', 'rejected', 'expired', 'withdrawn');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('msa', 'sow', 'purchase_order', 'change_order', 'nda');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'internal_review', 'out_for_signature', 'executed', 'active', 'expired', 'terminated', 'superseded');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('planned', 'active', 'on_hold', 'completed', 'terminated');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('proposed', 'active', 'on_hold', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('planned', 'in_progress', 'achieved', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('backlog', 'ready', 'in_progress', 'blocked', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('identified', 'assessed', 'mitigating', 'accepted', 'closed', 'realized');

-- CreateEnum
CREATE TYPE "RiskResponse" AS ENUM ('avoid', 'mitigate', 'transfer', 'accept');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('proposed', 'decided', 'superseded');

-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('not_started', 'in_preparation', 'ready_for_review', 'approved', 'conditionally_approved', 'rejected');

-- CreateEnum
CREATE TYPE "GateRequirementType" AS ENUM ('deliverable', 'document', 'approval', 'checklist', 'evidence');

-- CreateEnum
CREATE TYPE "GateRequirementStatus" AS ENUM ('open', 'satisfied', 'waived', 'not_applicable');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('approved', 'approved_with_conditions', 'rejected', 'revoked');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'implemented');

-- CreateEnum
CREATE TYPE "BaselineKind" AS ENUM ('scope', 'schedule', 'cost', 'integrated');

-- CreateEnum
CREATE TYPE "BaselineStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('planned', 'in_progress', 'submitted', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('proposal', 'contract', 'statement_of_work', 'change_request', 'gate_package', 'meeting_notes', 'deliverable', 'invoice', 'evidence', 'report', 'other');

-- CreateEnum
CREATE TYPE "DataClassification" AS ENUM ('public', 'internal', 'confidential', 'restricted');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'invoiced');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'internal_review', 'approved_for_release', 'sent', 'partially_paid', 'paid', 'void', 'disputed');

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('retainer', 'fixed_fee', 'milestone', 'hours', 'expense', 'adjustment');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ach', 'wire', 'check', 'card', 'other');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('recorded', 'verified', 'reversed');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'agent', 'system', 'workflow');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentActionStatus" AS ENUM ('executed', 'proposed', 'approved', 'rejected', 'applied', 'failed', 'denied', 'expired');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('disabled', 'configured', 'active', 'error');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(300),
    "kind" "OrganizationKind" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'active',
    "segment" "OrganizationSegment",
    "industry" VARCHAR(120),
    "website" VARCHAR(300),
    "phone" VARCHAR(50),
    "address_line1" VARCHAR(200),
    "address_line2" VARCHAR(200),
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "postal_code" VARCHAR(20),
    "country_code" CHAR(2),
    "notes" TEXT,
    "owner_user_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "user_type" "UserType" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'invited',
    "home_organization_id" UUID NOT NULL,
    "oidc_issuer" VARCHAR(500),
    "oidc_subject" VARCHAR(255),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "scope" "RoleScope" NOT NULL,
    "assignable_to" "UserType"[],
    "mfa_required" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "privileged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "organization_id" UUID,
    "granted_by_id" UUID,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_id" UUID,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(50),
    "job_title" VARCHAR(150),
    "status" "ContactStatus" NOT NULL DEFAULT 'active',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'lead',
    "commercial_model" "CommercialModel",
    "estimated_value_cents" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "probability_pct" INTEGER,
    "expected_close_date" DATE,
    "owner_user_id" UUID,
    "primary_contact_id" UUID,
    "source" VARCHAR(120),
    "lost_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "contact_id" UUID,
    "project_id" UUID,
    "kind" "ActivityKind" NOT NULL,
    "subject" VARCHAR(300) NOT NULL,
    "body" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "actor_type" "ActorType" NOT NULL DEFAULT 'user',
    "actor_user_id" UUID,
    "agent_run_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "number" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'draft',
    "commercial_model" "CommercialModel" NOT NULL,
    "total_cents" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "valid_until" DATE,
    "document_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "proposal_id" UUID,
    "parent_contract_id" UUID,
    "number" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "contract_type" "ContractType" NOT NULL,
    "commercial_model" "CommercialModel",
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "value_cents" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "customer_po_number" VARCHAR(80),
    "effective_date" DATE,
    "end_date" DATE,
    "document_id" UUID,
    "executed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "contract_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "commercial_model" "CommercialModel" NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'planned',
    "start_date" DATE,
    "end_date" DATE,
    "weekly_hours_target" DECIMAL(5,2),
    "monthly_fee_cents" BIGINT,
    "hourly_rate_cents" BIGINT,
    "fixed_fee_cents" BIGINT,
    "budget_hours" DECIMAL(8,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "engagement_manager_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'proposed',
    "equipment_type" VARCHAR(150),
    "site_location" VARCHAR(200),
    "customer_reference" VARCHAR(100),
    "start_date" DATE,
    "target_completion_date" DATE,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_projects" (
    "engagement_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "scope_notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_projects_pkey" PRIMARY KEY ("engagement_id","project_id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "added_by_id" UUID,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(3),
    "removed_by_id" UUID,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "engagement_id" UUID,
    "gate_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'planned',
    "planned_date" DATE,
    "forecast_date" DATE,
    "actual_date" DATE,
    "is_billable" BOOLEAN NOT NULL DEFAULT false,
    "amount_cents" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "milestone_id" UUID,
    "parent_task_id" UUID,
    "wbs_code" VARCHAR(40),
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'backlog',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "assignee_user_id" UUID,
    "planned_start" DATE,
    "planned_finish" DATE,
    "actual_start" DATE,
    "actual_finish" DATE,
    "estimate_hours" DECIMAL(8,2),
    "percent_complete" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "predecessor_task_id" UUID NOT NULL,
    "successor_task_id" UUID NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'finish_to_start',
    "lag_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(80),
    "probability" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'identified',
    "response" "RiskResponse",
    "mitigation_plan" TEXT,
    "trigger_description" TEXT,
    "owner_user_id" UUID,
    "due_date" DATE,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "risk_id" UUID,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'medium',
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "owner_user_id" UUID,
    "raised_by_id" UUID,
    "due_date" DATE,
    "resolution" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "change_request_id" UUID,
    "supersedes_decision_id" UUID,
    "title" VARCHAR(300) NOT NULL,
    "context" TEXT,
    "decision" TEXT NOT NULL,
    "rationale" TEXT,
    "status" "DecisionStatus" NOT NULL DEFAULT 'proposed',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "engagement_id" UUID,
    "number" VARCHAR(20) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'draft',
    "cost_impact_cents" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "schedule_impact_days" INTEGER,
    "scope_impact" TEXT,
    "requested_by_user_id" UUID,
    "requested_by_contact_id" UUID,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "status" "GateStatus" NOT NULL DEFAULT 'not_started',
    "required_approval_level" INTEGER NOT NULL,
    "planned_date" DATE,
    "package_document_id" UUID,
    "baseline_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gate_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "requirement_type" "GateRequirementType" NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "status" "GateRequirementStatus" NOT NULL DEFAULT 'open',
    "deliverable_id" UUID,
    "evidence_document_revision_id" UUID,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "waiver_approval_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gate_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baselines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "kind" "BaselineKind" NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "BaselineStatus" NOT NULL DEFAULT 'draft',
    "snapshot" JSONB NOT NULL,
    "content_sha256" CHAR(64) NOT NULL,
    "change_request_id" UUID,
    "supersedes_baseline_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(3),

    CONSTRAINT "baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "milestone_id" UUID,
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "deliverable_type" VARCHAR(80),
    "status" "DeliverableStatus" NOT NULL DEFAULT 'planned',
    "due_date" DATE,
    "document_id" UUID,
    "acceptance_approval_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purpose" VARCHAR(60) NOT NULL,
    "level" INTEGER NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "document_revision_id" UUID,
    "baseline_id" UUID,
    "content_sha256" CHAR(64) NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "approver_user_id" UUID NOT NULL,
    "authority_basis" JSONB NOT NULL,
    "mfa_verified" BOOLEAN NOT NULL,
    "evidence_document_revision_id" UUID,
    "conditions" TEXT,
    "comment" TEXT,
    "revokes_approval_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_id" VARCHAR(100),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "engagement_id" UUID,
    "title" VARCHAR(300) NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "classification" "DataClassification" NOT NULL DEFAULT 'confidential',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "revision_label" VARCHAR(20),
    "storage_key" VARCHAR(500) NOT NULL,
    "content_sha256" CHAR(64) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "change_summary" TEXT,
    "created_by_type" "ActorType" NOT NULL DEFAULT 'user',
    "created_by_id" UUID,
    "agent_run_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "project_id" UUID,
    "task_id" UUID,
    "work_date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'draft',
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "invoice_line_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "engagement_id" UUID NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "issue_date" DATE,
    "due_date" DATE,
    "period_start" DATE,
    "period_end" DATE,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal_cents" BIGINT NOT NULL DEFAULT 0,
    "tax_cents" BIGINT NOT NULL DEFAULT 0,
    "total_cents" BIGINT NOT NULL DEFAULT 0,
    "document_id" UUID,
    "external_ref" VARCHAR(120),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "line_type" "InvoiceLineType" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_price_cents" BIGINT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "milestone_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "received_on" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(120),
    "status" "PaymentStatus" NOT NULL DEFAULT 'recorded',
    "evidence_document_revision_id" UUID,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "recorded_by_type" "ActorType" NOT NULL DEFAULT 'user',
    "recorded_by_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_key" VARCHAR(60) NOT NULL,
    "agent_version" VARCHAR(40) NOT NULL,
    "prompt_version" VARCHAR(40),
    "status" "AgentRunStatus" NOT NULL DEFAULT 'queued',
    "trigger_type" VARCHAR(40) NOT NULL,
    "triggered_by_id" UUID,
    "workflow_id" VARCHAR(200),
    "parent_run_id" UUID,
    "organization_id" UUID,
    "project_id" UUID,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" JSONB,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "model_provider" VARCHAR(60),
    "model_name" VARCHAR(120),
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micros_usd" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_run_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "tool_name" VARCHAR(120),
    "target_type" VARCHAR(60),
    "target_id" UUID,
    "arguments" JSONB,
    "proposed_change" JSONB,
    "result" JSONB,
    "required_approval_level" INTEGER NOT NULL DEFAULT 0,
    "status" "AgentActionStatus" NOT NULL,
    "approval_id" UUID,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "applied_at" TIMESTAMPTZ(3),
    "error" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sequence" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" UUID,
    "actor_agent_run_id" UUID,
    "organization_id" UUID,
    "project_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "request_id" VARCHAR(100),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "prev_hash" CHAR(64),
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'in_app',
    "kind" VARCHAR(60) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "body" TEXT,
    "link_path" VARCHAR(500),
    "entity_type" VARCHAR(60),
    "entity_id" UUID,
    "read_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "provider" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'disabled',
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret_ref" VARCHAR(300),
    "last_sync_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "user_id" UUID NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "operation" VARCHAR(120) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateIndex
CREATE INDEX "organizations_kind_status_idx" ON "organizations"("kind", "status");

-- CreateIndex
CREATE INDEX "organizations_name_idx" ON "organizations"("name");

-- CreateIndex
CREATE INDEX "organizations_owner_user_id_idx" ON "organizations"("owner_user_id");

-- CreateIndex
CREATE INDEX "users_home_organization_id_idx" ON "users"("home_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_oidc_issuer_oidc_subject_key" ON "users"("oidc_issuer", "oidc_subject");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "role_assignments_user_id_idx" ON "role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "role_assignments_organization_id_idx" ON "role_assignments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_user_id_key" ON "contacts"("user_id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_idx" ON "contacts"("organization_id");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_idx" ON "opportunities"("organization_id");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_owner_user_id_idx" ON "opportunities"("owner_user_id");

-- CreateIndex
CREATE INDEX "activities_organization_id_occurred_at_idx" ON "activities"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activities_opportunity_id_idx" ON "activities"("opportunity_id");

-- CreateIndex
CREATE INDEX "activities_project_id_idx" ON "activities"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_number_key" ON "proposals"("number");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_document_id_key" ON "proposals"("document_id");

-- CreateIndex
CREATE INDEX "proposals_organization_id_idx" ON "proposals"("organization_id");

-- CreateIndex
CREATE INDEX "proposals_opportunity_id_idx" ON "proposals"("opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_number_key" ON "contracts"("number");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_document_id_key" ON "contracts"("document_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_idx" ON "contracts"("organization_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "engagements_organization_id_idx" ON "engagements"("organization_id");

-- CreateIndex
CREATE INDEX "engagements_status_idx" ON "engagements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_id_organization_id_key" ON "projects"("id", "organization_id");

-- CreateIndex
CREATE INDEX "engagement_projects_project_id_idx" ON "engagement_projects"("project_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");

-- CreateIndex
CREATE INDEX "milestones_project_id_planned_date_idx" ON "milestones"("project_id", "planned_date");

-- CreateIndex
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "tasks_assignee_user_id_idx" ON "tasks"("assignee_user_id");

-- CreateIndex
CREATE INDEX "tasks_milestone_id_idx" ON "tasks"("milestone_id");

-- CreateIndex
CREATE INDEX "dependencies_successor_task_id_idx" ON "dependencies"("successor_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "dependencies_predecessor_task_id_successor_task_id_key" ON "dependencies"("predecessor_task_id", "successor_task_id");

-- CreateIndex
CREATE INDEX "risks_project_id_status_idx" ON "risks"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "risks_project_id_code_key" ON "risks"("project_id", "code");

-- CreateIndex
CREATE INDEX "issues_project_id_status_idx" ON "issues"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "issues_project_id_code_key" ON "issues"("project_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_supersedes_decision_id_key" ON "decisions"("supersedes_decision_id");

-- CreateIndex
CREATE INDEX "decisions_project_id_idx" ON "decisions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_requests_document_id_key" ON "change_requests"("document_id");

-- CreateIndex
CREATE INDEX "change_requests_project_id_status_idx" ON "change_requests"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "change_requests_project_id_number_key" ON "change_requests"("project_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "gates_package_document_id_key" ON "gates"("package_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "gates_project_id_sequence_key" ON "gates"("project_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "gates_project_id_code_key" ON "gates"("project_id", "code");

-- CreateIndex
CREATE INDEX "gate_requirements_gate_id_idx" ON "gate_requirements"("gate_id");

-- CreateIndex
CREATE UNIQUE INDEX "baselines_supersedes_baseline_id_key" ON "baselines"("supersedes_baseline_id");

-- CreateIndex
CREATE UNIQUE INDEX "baselines_project_id_kind_revision_key" ON "baselines"("project_id", "kind", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "deliverables_document_id_key" ON "deliverables"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliverables_acceptance_approval_id_key" ON "deliverables"("acceptance_approval_id");

-- CreateIndex
CREATE INDEX "deliverables_project_id_status_idx" ON "deliverables"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_revokes_approval_id_key" ON "approvals"("revokes_approval_id");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_idempotency_key_key" ON "approvals"("idempotency_key");

-- CreateIndex
CREATE INDEX "approvals_document_revision_id_idx" ON "approvals"("document_revision_id");

-- CreateIndex
CREATE INDEX "approvals_baseline_id_idx" ON "approvals"("baseline_id");

-- CreateIndex
CREATE INDEX "approvals_organization_id_decided_at_idx" ON "approvals"("organization_id", "decided_at");

-- CreateIndex
CREATE INDEX "approvals_approver_user_id_idx" ON "approvals"("approver_user_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_document_type_idx" ON "documents"("organization_id", "document_type");

-- CreateIndex
CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");

-- CreateIndex
CREATE INDEX "document_revisions_content_sha256_idx" ON "document_revisions"("content_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "document_revisions_document_id_revision_number_key" ON "document_revisions"("document_id", "revision_number");

-- CreateIndex
CREATE INDEX "time_entries_user_id_work_date_idx" ON "time_entries"("user_id", "work_date");

-- CreateIndex
CREATE INDEX "time_entries_engagement_id_work_date_idx" ON "time_entries"("engagement_id", "work_date");

-- CreateIndex
CREATE INDEX "time_entries_invoice_line_id_idx" ON "time_entries"("invoice_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_document_id_key" ON "invoices"("document_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_idx" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invoices_engagement_id_idx" ON "invoices"("engagement_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_received_on_idx" ON "payments"("organization_id", "received_on");

-- CreateIndex
CREATE INDEX "agent_runs_agent_key_created_at_idx" ON "agent_runs"("agent_key", "created_at");

-- CreateIndex
CREATE INDEX "agent_runs_organization_id_created_at_idx" ON "agent_runs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE INDEX "agent_actions_status_idx" ON "agent_actions"("status");

-- CreateIndex
CREATE INDEX "agent_actions_target_type_target_id_idx" ON "agent_actions"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_actions_agent_run_id_sequence_key" ON "agent_actions"("agent_run_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_sequence_key" ON "audit_events"("sequence");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_idx" ON "audit_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_occurred_at_idx" ON "audit_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_occurred_at_idx" ON "audit_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_organization_id_provider_name_key" ON "integrations"("organization_id", "provider", "name");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_home_organization_id_fkey" FOREIGN KEY ("home_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_primary_contact_id_fkey" FOREIGN KEY ("primary_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_parent_contract_id_fkey" FOREIGN KEY ("parent_contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_projects" ADD CONSTRAINT "engagement_projects_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_projects" ADD CONSTRAINT "engagement_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_predecessor_task_id_fkey" FOREIGN KEY ("predecessor_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_successor_task_id_fkey" FOREIGN KEY ("successor_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_supersedes_decision_id_fkey" FOREIGN KEY ("supersedes_decision_id") REFERENCES "decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_package_document_id_fkey" FOREIGN KEY ("package_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_baseline_id_fkey" FOREIGN KEY ("baseline_id") REFERENCES "baselines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_requirements" ADD CONSTRAINT "gate_requirements_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_requirements" ADD CONSTRAINT "gate_requirements_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_requirements" ADD CONSTRAINT "gate_requirements_evidence_document_revision_id_fkey" FOREIGN KEY ("evidence_document_revision_id") REFERENCES "document_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_requirements" ADD CONSTRAINT "gate_requirements_waiver_approval_id_fkey" FOREIGN KEY ("waiver_approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_supersedes_baseline_id_fkey" FOREIGN KEY ("supersedes_baseline_id") REFERENCES "baselines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_acceptance_approval_id_fkey" FOREIGN KEY ("acceptance_approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_document_revision_id_fkey" FOREIGN KEY ("document_revision_id") REFERENCES "document_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_baseline_id_fkey" FOREIGN KEY ("baseline_id") REFERENCES "baselines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_evidence_document_revision_id_fkey" FOREIGN KEY ("evidence_document_revision_id") REFERENCES "document_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_revokes_approval_id_fkey" FOREIGN KEY ("revokes_approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_evidence_document_revision_id_fkey" FOREIGN KEY ("evidence_document_revision_id") REFERENCES "document_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "agent_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

