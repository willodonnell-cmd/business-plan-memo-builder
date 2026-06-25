import { getD1 } from "../db";
import {
  DEFAULT_PLAN_ID,
  type Approver,
  type BusinessPlanWorkstream,
  type EnablementFunction,
  type IssueType,
  type Question,
  type QuestionStatus,
  type Role,
  type SectionStatus,
  type Visibility,
  type WorkspacePlan,
  approverDefaults,
  businessPlanWorkstreams,
  sectionDefaults,
} from "./workspace-defaults";

type BusinessPlanRow = {
  id: string;
  title: string;
  team_name: string;
  approval_state: SectionStatus;
  approval_posture: string;
};

type SectionRow = {
  id: string;
  section_key: string;
  title: string;
  position: number;
  content: string;
  status: SectionStatus;
};

type QuestionRow = {
  id: string;
  section_id: string;
  author_name: string;
  author_role: Role;
  visibility: Visibility;
  status: QuestionStatus;
  issue_type: IssueType | null;
  function_name: EnablementFunction | null;
  body: string;
  response: string | null;
};

type ApproverRow = {
  id: string;
  name: string;
  title: string;
  posture: string;
};

const allowedSectionStatuses = ["Draft", "Review", "Approved"] as const;
const allowedQuestionStatuses = ["Open", "Answered", "Resolved", "Reopened", "No Change Needed"] as const;
const allowedIssueTypes = [
  "Clarification",
  "Functional Dependency",
  "Support Need",
  "Risk / Constraint",
  "Required Input",
  "Approval Concern",
] as const;
const allowedEnablementFunctions = ["", "HR", "Legal", "IT", "Finance & Accounting", "Tax", "Marketing", "CLS", "Other"] as const;
const allowedRoles = ["Business Team", "Enablement", "Approver"] as const;
const allowedVisibility = ["Public", "Draft", "Private"] as const;
const placeholderApproverNames = ["M. Rivera", "A. Chen", "S. Williams"];
const adminEmail = "wodonnell@prologis.com";
const cleanMemoContentMarker = "2026-06-23-clean-memo-section-content";
const cleanWorkflowTestDataMarker = "2026-06-24-clean-workflow-test-data";

export function toRouteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "The D1 tables are unavailable. The app can create them during local development, but the hosted database must have the generated Drizzle migration applied.";
  }
  return message;
}

export function resolvePlanId(value?: string | null) {
  const requested = value?.trim();
  return businessPlanWorkstreams.find((workstream) => workstream.id === requested)?.id ?? DEFAULT_PLAN_ID;
}

export function getWorkstreamByPlanId(planId: string): BusinessPlanWorkstream {
  return businessPlanWorkstreams.find((workstream) => workstream.id === planId) ?? businessPlanWorkstreams[0];
}

export async function getWorkspacePlan(planIdInput?: string | null): Promise<WorkspacePlan> {
  const planId = resolvePlanId(planIdInput);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const plan = await d1
    .prepare(
      "SELECT id, title, team_name, approval_state, approval_posture FROM business_plans WHERE id = ?",
    )
    .bind(planId)
    .first<BusinessPlanRow>();

  if (!plan) {
    throw new Error("Default business plan could not be loaded.");
  }

  const sections = await d1
    .prepare(
      "SELECT id, section_key, title, position, content, status FROM memo_sections WHERE plan_id = ? ORDER BY position ASC",
    )
    .bind(planId)
    .all<SectionRow>();

  const questions = await d1
    .prepare(
      "SELECT id, section_id, author_name, author_role, visibility, status, issue_type, function_name, body, response FROM section_questions WHERE plan_id = ? ORDER BY created_at DESC",
    )
    .bind(planId)
    .all<QuestionRow>();

  const approvers = await d1
    .prepare("SELECT id, name, title, posture FROM approvers WHERE plan_id = ? ORDER BY name ASC")
    .bind(planId)
    .all<ApproverRow>();

  return {
    id: plan.id,
    title: plan.title,
    teamName: plan.team_name,
    approvalState: plan.approval_state,
    approvalPosture: plan.approval_posture,
    sections: (sections.results ?? []).map((section) => {
      const defaults = sectionDefaults.find((item) => item.key === section.section_key);
      return {
        id: section.id,
        sectionKey: section.section_key,
        title: section.title,
        prompt: defaults?.prompt ?? "",
        format: defaults?.format ?? "",
        emphasize: defaults?.emphasize ?? "",
        avoid: defaults?.avoid ?? "",
        content: section.content,
        status: section.status,
      };
    }),
    questions: (questions.results ?? []).map(toQuestion),
    approvers: (approvers.results ?? []).map(toApprover),
  };
}

export async function updatePlan(input: {
  planId?: string;
  teamName?: string;
  approvalState?: SectionStatus;
  approvalPosture?: string;
}) {
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const current = await d1
    .prepare("SELECT team_name, approval_state, approval_posture FROM business_plans WHERE id = ?")
    .bind(planId)
    .first<{ team_name: string; approval_state: SectionStatus; approval_posture: string }>();

  const teamName = input.teamName?.trim() ?? current?.team_name ?? "";
  const title = `2027 ${teamName || "[Team Name]"} Business Plan`;
  const approvalState = normalize(input.approvalState, allowedSectionStatuses, current?.approval_state ?? "Draft");
  const approvalPosture = input.approvalPosture?.trim() ?? current?.approval_posture ?? "Drafting";

  await d1
    .prepare(
      "UPDATE business_plans SET title = ?, team_name = ?, approval_state = ?, approval_posture = ?, updated_at = ? WHERE id = ?",
    )
    .bind(title, teamName, approvalState, approvalPosture, Date.now(), planId)
    .run();
}

export async function updateSection(
  id: string,
  input: { planId?: string; content?: string; status?: SectionStatus },
) {
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const current = await d1
    .prepare("SELECT content, status FROM memo_sections WHERE id = ? AND plan_id = ?")
    .bind(id, planId)
    .first<{ content: string; status: SectionStatus }>();

  if (!current) {
    throw new Error("Section not found.");
  }

  await d1
    .prepare("UPDATE memo_sections SET content = ?, status = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(input.content ?? current.content, normalize(input.status, allowedSectionStatuses, current.status), Date.now(), id, planId)
    .run();
}

export async function createQuestion(input: {
  planId?: string;
  sectionId?: string;
  author?: string;
  role?: Role;
  visibility?: Visibility;
  issueType?: IssueType;
  functionName?: EnablementFunction | "";
  body?: string;
}) {
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const sectionId = input.sectionId?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (!sectionId || !body) {
    throw new Error("sectionId and body are required.");
  }

  const section = await d1
    .prepare("SELECT id FROM memo_sections WHERE id = ? AND plan_id = ?")
    .bind(sectionId, planId)
    .first<{ id: string }>();

  if (!section) {
    throw new Error("Section not found.");
  }

  const role = normalize(input.role, allowedRoles, "Enablement");
  const author = input.author?.trim() || authorForRole(role);
  const existingQuestion = await d1
    .prepare(
      "SELECT id FROM section_questions WHERE plan_id = ? AND section_id = ? AND author_name = ? AND author_role = ? AND body = ? LIMIT 1",
    )
    .bind(planId, sectionId, author, role, body)
    .first<{ id: string }>();

  if (existingQuestion) {
    return;
  }

  const now = Date.now();
  await d1
    .prepare(
      "INSERT INTO section_questions (id, plan_id, section_id, author_name, author_role, visibility, status, issue_type, function_name, body, response, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      planId,
      sectionId,
      author,
      role,
      normalize(input.visibility, allowedVisibility, "Public"),
      "Open",
      normalize(input.issueType, allowedIssueTypes, role === "Approver" ? "Approval Concern" : "Clarification"),
      normalize(input.functionName, allowedEnablementFunctions, ""),
      body,
      null,
      now,
      now,
    )
    .run();
}

export async function updateQuestion(
  id: string,
  input: { planId?: string; role?: Role; status?: QuestionStatus; response?: string },
) {
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const current = await d1
    .prepare("SELECT status, response FROM section_questions WHERE id = ? AND plan_id = ?")
    .bind(id, planId)
    .first<{ status: QuestionStatus; response: string | null }>();

  if (!current) {
    throw new Error("Question not found.");
  }

  const actingRole = normalize(input.role, allowedRoles, "Business Team");
  const nextStatus = normalize(input.status, allowedQuestionStatuses, current.status);
  if (input.status && !allowedQuestionStatusForRole(actingRole, nextStatus)) {
    throw new Error("This role cannot set that question status.");
  }

  await d1
    .prepare("UPDATE section_questions SET status = ?, response = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(
      nextStatus,
      input.response ?? current.response,
      Date.now(),
      id,
      planId,
    )
    .run();
}

export async function deleteQuestion(id: string, planIdInput?: string | null, role?: Role) {
  const planId = resolvePlanId(planIdInput);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const question = await d1
    .prepare("SELECT author_role FROM section_questions WHERE id = ? AND plan_id = ?")
    .bind(id, planId)
    .first<{ author_role: Role }>();

  if (!question) {
    throw new Error("Question not found.");
  }

  const actingRole = normalize(role, allowedRoles, "Business Team");
  if (actingRole !== "Business Team" && actingRole !== question.author_role) {
    throw new Error("Only the submitting role or Business Team can delete this question.");
  }

  await d1.prepare("DELETE FROM section_questions WHERE id = ? AND plan_id = ?").bind(id, planId).run();
}

export async function createApprover(input: { planId?: string; name?: string; title?: string; posture?: string; requesterEmail?: string }) {
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  if (input.requesterEmail?.trim().toLowerCase() !== adminEmail) {
    throw new Error("Only Will can add approvers.");
  }

  const name = input.name?.trim();
  if (!name) {
    throw new Error("name is required.");
  }

  const now = Date.now();
  await d1
    .prepare(
      "INSERT INTO approvers (id, plan_id, name, title, posture, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      `${planId}-approver-${slug(name)}-${now}`,
      planId,
      name,
      input.title?.trim() || "Approver",
      input.posture?.trim() || "Reviewing",
      now,
    )
    .run();
}

export async function updateApprover(id: string, input: { planId?: string; posture?: string }) {
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const posture = input.posture?.trim();
  if (!posture) {
    throw new Error("posture is required.");
  }

  const result = await d1
    .prepare("UPDATE approvers SET posture = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(posture, Date.now(), id, planId)
    .run();

  if (!result.meta.rows_written) {
    throw new Error("Approver not found.");
  }
}

async function ensureSchema(d1: D1Database) {
  const statements = [
    "CREATE TABLE IF NOT EXISTS business_plans (id text PRIMARY KEY NOT NULL, title text NOT NULL, team_name text NOT NULL, approval_state text DEFAULT 'Draft' NOT NULL, approval_posture text DEFAULT 'Drafting' NOT NULL, created_by text, updated_at integer NOT NULL)",
    "CREATE TABLE IF NOT EXISTS memo_sections (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, section_key text NOT NULL, title text NOT NULL, position integer NOT NULL, requirement text DEFAULT '' NOT NULL, content text DEFAULT '' NOT NULL, status text DEFAULT 'Draft' NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS section_questions (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, section_id text NOT NULL, author_name text NOT NULL, author_role text NOT NULL, visibility text DEFAULT 'Public' NOT NULL, status text DEFAULT 'Open' NOT NULL, issue_type text DEFAULT 'Clarification' NOT NULL, function_name text DEFAULT '' NOT NULL, body text NOT NULL, response text, created_at integer NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade, FOREIGN KEY (section_id) REFERENCES memo_sections(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS approvers (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, name text NOT NULL, title text NOT NULL, posture text DEFAULT 'Reviewing' NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at integer NOT NULL)",
  ];

  for (const statement of statements) {
    await d1.prepare(statement).run();
  }

  await addColumnIfMissing(d1, "business_plans", "approval_state", "text DEFAULT 'Draft' NOT NULL");
  await addColumnIfMissing(d1, "business_plans", "approval_posture", "text DEFAULT 'Drafting' NOT NULL");
  await addColumnIfMissing(d1, "business_plans", "created_by", "text");
  await addColumnIfMissing(d1, "memo_sections", "section_key", "text");
  await addColumnIfMissing(d1, "memo_sections", "requirement", "text DEFAULT '' NOT NULL");
  await addColumnIfMissing(d1, "section_questions", "issue_type", "text DEFAULT 'Clarification' NOT NULL");
  await addColumnIfMissing(d1, "section_questions", "function_name", "text DEFAULT '' NOT NULL");
  await backfillSectionKeys(d1);
  await clearExistingMemoContentOnce(d1);
  await clearWorkflowTestDataOnce(d1);
}

async function ensureDefaultWorkspace(d1: D1Database, planId: string) {
  const workstream = getWorkstreamByPlanId(planId);
  const existing = await d1
    .prepare("SELECT id, title, team_name FROM business_plans WHERE id = ?")
    .bind(planId)
    .first<{ id: string; title: string; team_name: string }>();

  if (existing) {
    if (shouldRestoreWorkstreamIdentity(existing, workstream)) {
      await d1
        .prepare("UPDATE business_plans SET title = ?, team_name = ?, updated_at = ? WHERE id = ?")
        .bind(workstream.title, workstream.teamName, Date.now(), planId)
        .run();
    }
    await ensureSectionDefaults(d1, planId);
    return;
  }

  const now = Date.now();
  await d1.batch([
    d1
      .prepare(
        "INSERT INTO business_plans (id, title, team_name, approval_state, approval_posture, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(planId, workstream.title, workstream.teamName, "Draft", "Drafting", null, now),
    ...sectionDefaults.map((section, index) =>
      d1
        .prepare(
          "INSERT INTO memo_sections (id, plan_id, section_key, title, position, requirement, content, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `${planId}-${section.key}`,
          planId,
          section.key,
          section.title,
          index + 1,
          section.format,
          section.content,
          section.status,
          now,
        ),
    ),
    ...approverDefaults.map((approver) =>
      d1
        .prepare(
          "INSERT INTO approvers (id, plan_id, name, title, posture, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(`${planId}-approver-${slug(approver.name)}`, planId, approver.name, approver.title, approver.posture, now),
    ),
  ]);
}

async function ensureDefaultWorkstreams(d1: D1Database) {
  for (const workstream of businessPlanWorkstreams) {
    await ensureDefaultWorkspace(d1, workstream.id);
    await ensureApproverDefaults(d1, workstream.id);
  }
}

function shouldRestoreWorkstreamIdentity(
  existing: { title: string; team_name: string },
  workstream: BusinessPlanWorkstream,
) {
  if (existing.title.includes("[Team Name]") || !existing.team_name) {
    return true;
  }
  if (existing.title === workstream.title && existing.team_name === workstream.teamName) {
    return false;
  }
  return businessPlanWorkstreams.some(
    (item) =>
      item.id !== workstream.id &&
      (existing.title === item.title || existing.team_name === item.teamName),
  );
}

async function ensureSectionDefaults(d1: D1Database, planId: string) {
  const rows = await d1
    .prepare("SELECT section_key FROM memo_sections WHERE plan_id = ?")
    .bind(planId)
    .all<{ section_key?: string | null }>();

  const existingKeys = new Set((rows.results ?? []).map((row) => row.section_key).filter(Boolean));
  const missingSections = sectionDefaults.filter((section) => !existingKeys.has(section.key));
  if (missingSections.length === 0) {
    return;
  }

  const now = Date.now();
  await d1.batch(
    missingSections.map((section) =>
      d1
        .prepare(
          "INSERT INTO memo_sections (id, plan_id, section_key, title, position, requirement, content, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `${planId}-${section.key}`,
          planId,
          section.key,
          section.title,
          sectionDefaults.findIndex((item) => item.key === section.key) + 1,
          section.format,
          section.content,
          section.status,
          now,
        ),
    ),
  );
}

async function ensureApproverDefaults(d1: D1Database, planId: string) {
  const rows = await d1
    .prepare("SELECT id, name FROM approvers WHERE plan_id = ?")
    .bind(planId)
    .all<{ id: string; name: string }>();

  const existingNames = new Set((rows.results ?? []).map((row) => row.name));
  const statements = [];
  const now = Date.now();

  for (const name of placeholderApproverNames) {
    if (existingNames.has(name)) {
      statements.push(
        d1.prepare("DELETE FROM approvers WHERE plan_id = ? AND name = ?").bind(planId, name),
      );
    }
  }

  for (const approver of approverDefaults) {
    if (!existingNames.has(approver.name)) {
      statements.push(
        d1
          .prepare(
            "INSERT INTO approvers (id, plan_id, name, title, posture, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(`${planId}-approver-${slug(approver.name)}`, planId, approver.name, approver.title, approver.posture, now),
      );
    }
  }

  statements.push(
    d1
      .prepare("UPDATE approvers SET posture = ?, updated_at = ? WHERE plan_id = ? AND posture IN (?, ?, ?)")
      .bind("Needs Revision", now, planId, "Reviewing", "Needs answers", "Supportive"),
  );

  if (statements.length > 0) {
    await d1.batch(statements);
  }
}

function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    sectionId: row.section_id,
    author: row.author_name,
    role: row.author_role,
    visibility: row.visibility,
    status: normalize(row.status, allowedQuestionStatuses, row.status === "Acknowledged" ? "Answered" : "Open"),
    issueType: normalize(row.issue_type, allowedIssueTypes, "Clarification"),
    functionName: normalize(row.function_name, allowedEnablementFunctions, ""),
    body: row.body,
    response: row.response ?? "",
  };
}

function toApprover(row: ApproverRow): Approver {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    posture: row.posture,
  };
}

function normalize<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function allowedQuestionStatusForRole(role: Role, status: QuestionStatus) {
  if (role === "Business Team") {
    return status === "Open" || status === "Answered" || status === "Resolved" || status === "No Change Needed";
  }
  return status === "Open" || status === "Reopened" || status === "Resolved";
}

async function addColumnIfMissing(d1: D1Database, table: string, column: string, definition: string) {
  const rows = await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if ((rows.results ?? []).some((row) => row.name === column)) {
    return;
  }
  await d1.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

async function clearExistingMemoContentOnce(d1: D1Database) {
  const existing = await d1
    .prepare("SELECT key FROM app_meta WHERE key = ?")
    .bind(cleanMemoContentMarker)
    .first<{ key: string }>();

  if (existing) {
    return;
  }

  const now = Date.now();
  await d1.batch([
    ...businessPlanWorkstreams.map((workstream) =>
      d1
        .prepare("UPDATE memo_sections SET content = '', updated_at = ? WHERE plan_id = ?")
        .bind(now, workstream.id),
    ),
    d1
      .prepare("INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
      .bind(cleanMemoContentMarker, "done", now),
  ]);
}

async function clearWorkflowTestDataOnce(d1: D1Database) {
  const existing = await d1
    .prepare("SELECT key FROM app_meta WHERE key = ?")
    .bind(cleanWorkflowTestDataMarker)
    .first<{ key: string }>();

  if (existing) {
    return;
  }

  const now = Date.now();
  await d1.batch([
    ...businessPlanWorkstreams.flatMap((workstream) => [
      d1
        .prepare("UPDATE memo_sections SET content = '', updated_at = ? WHERE plan_id = ?")
        .bind(now, workstream.id),
      d1.prepare("DELETE FROM section_questions WHERE plan_id = ?").bind(workstream.id),
      d1.prepare("DELETE FROM approvers WHERE plan_id = ?").bind(workstream.id),
      d1
        .prepare(
          "UPDATE business_plans SET approval_state = ?, approval_posture = ?, updated_at = ? WHERE id = ?",
        )
        .bind("Draft", "Drafting", now, workstream.id),
    ]),
    d1
      .prepare("INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
      .bind(cleanWorkflowTestDataMarker, "done", now),
  ]);
}

async function backfillSectionKeys(d1: D1Database) {
  const rows = await d1
    .prepare("SELECT id, plan_id, title, position, section_key FROM memo_sections ORDER BY plan_id ASC, position ASC")
    .all<{ id: string; plan_id: string; title: string; position: number; section_key?: string | null }>();

  const updates = [];

  for (const row of rows.results ?? []) {
    if (row.section_key?.trim()) {
      continue;
    }

    const byTitle = sectionDefaults.find((section) => section.title === row.title);
    const byPosition = Number.isInteger(row.position) ? sectionDefaults[row.position - 1] : undefined;
    const resolvedKey = byTitle?.key ?? byPosition?.key;

    if (!resolvedKey) {
      continue;
    }

    updates.push(
      d1.prepare("UPDATE memo_sections SET section_key = ? WHERE id = ? AND plan_id = ?").bind(resolvedKey, row.id, row.plan_id),
    );
  }

  if (updates.length > 0) {
    await d1.batch(updates);
  }
}

function authorForRole(role: Role) {
  if (role === "Business Team") return "Business Team Owner";
  return role;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
