import { getD1 } from "../db";
import {
  PLAN_ID,
  type Approver,
  type EnablementFunction,
  type IssueType,
  type Question,
  type QuestionStatus,
  type Role,
  type SectionStatus,
  type Visibility,
  type WorkspacePlan,
  approverDefaults,
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
const allowedEnablementFunctions = ["", "Legal", "HR", "Marketing", "IT", "Customer Account Management", "Other"] as const;
const allowedRoles = ["Business Team", "Enablement", "Approver"] as const;
const allowedVisibility = ["Public", "Draft", "Private"] as const;
const placeholderApproverNames = ["M. Rivera", "A. Chen", "S. Williams"];
const adminEmail = "wodonnell@prologis.com";

export function toRouteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "The D1 tables are unavailable. The app can create them during local development, but the hosted database must have the generated Drizzle migration applied.";
  }
  return message;
}

export async function getWorkspacePlan(): Promise<WorkspacePlan> {
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkspace(d1);
  await ensureApproverDefaults(d1);

  const plan = await d1
    .prepare(
      "SELECT id, title, team_name, approval_state, approval_posture FROM business_plans WHERE id = ?",
    )
    .bind(PLAN_ID)
    .first<BusinessPlanRow>();

  if (!plan) {
    throw new Error("Default business plan could not be loaded.");
  }

  const sections = await d1
    .prepare(
      "SELECT id, section_key, title, position, content, status FROM memo_sections WHERE plan_id = ? ORDER BY position ASC",
    )
    .bind(PLAN_ID)
    .all<SectionRow>();

  const questions = await d1
    .prepare(
      "SELECT id, section_id, author_name, author_role, visibility, status, issue_type, function_name, body, response FROM section_questions WHERE plan_id = ? ORDER BY created_at DESC",
    )
    .bind(PLAN_ID)
    .all<QuestionRow>();

  const approvers = await d1
    .prepare("SELECT id, name, title, posture FROM approvers WHERE plan_id = ? ORDER BY name ASC")
    .bind(PLAN_ID)
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
  teamName?: string;
  approvalState?: SectionStatus;
  approvalPosture?: string;
}) {
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkspace(d1);

  const current = await d1
    .prepare("SELECT team_name, approval_state, approval_posture FROM business_plans WHERE id = ?")
    .bind(PLAN_ID)
    .first<{ team_name: string; approval_state: SectionStatus; approval_posture: string }>();

  const teamName = input.teamName?.trim() ?? current?.team_name ?? "";
  const title = `2027 ${teamName || "[Team Name]"} Business Plan`;
  const approvalState = normalize(input.approvalState, allowedSectionStatuses, current?.approval_state ?? "Draft");
  const approvalPosture = input.approvalPosture?.trim() ?? current?.approval_posture ?? "Drafting";

  await d1
    .prepare(
      "UPDATE business_plans SET title = ?, team_name = ?, approval_state = ?, approval_posture = ?, updated_at = ? WHERE id = ?",
    )
    .bind(title, teamName, approvalState, approvalPosture, Date.now(), PLAN_ID)
    .run();
}

export async function updateSection(
  id: string,
  input: { content?: string; status?: SectionStatus },
) {
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkspace(d1);

  const current = await d1
    .prepare("SELECT content, status FROM memo_sections WHERE id = ? AND plan_id = ?")
    .bind(id, PLAN_ID)
    .first<{ content: string; status: SectionStatus }>();

  if (!current) {
    throw new Error("Section not found.");
  }

  await d1
    .prepare("UPDATE memo_sections SET content = ?, status = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(input.content ?? current.content, normalize(input.status, allowedSectionStatuses, current.status), Date.now(), id, PLAN_ID)
    .run();
}

export async function createQuestion(input: {
  sectionId?: string;
  author?: string;
  role?: Role;
  visibility?: Visibility;
  issueType?: IssueType;
  functionName?: EnablementFunction | "";
  body?: string;
}) {
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkspace(d1);

  const sectionId = input.sectionId?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (!sectionId || !body) {
    throw new Error("sectionId and body are required.");
  }

  const section = await d1
    .prepare("SELECT id FROM memo_sections WHERE id = ? AND plan_id = ?")
    .bind(sectionId, PLAN_ID)
    .first<{ id: string }>();

  if (!section) {
    throw new Error("Section not found.");
  }

  const role = normalize(input.role, allowedRoles, "Enablement");
  const now = Date.now();
  await d1
    .prepare(
      "INSERT INTO section_questions (id, plan_id, section_id, author_name, author_role, visibility, status, issue_type, function_name, body, response, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      PLAN_ID,
      sectionId,
      input.author?.trim() || authorForRole(role),
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
  input: { status?: QuestionStatus; response?: string },
) {
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkspace(d1);

  const current = await d1
    .prepare("SELECT status, response FROM section_questions WHERE id = ? AND plan_id = ?")
    .bind(id, PLAN_ID)
    .first<{ status: QuestionStatus; response: string | null }>();

  if (!current) {
    throw new Error("Question not found.");
  }

  await d1
    .prepare("UPDATE section_questions SET status = ?, response = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(
      normalize(input.status, allowedQuestionStatuses, current.status),
      input.response ?? current.response,
      Date.now(),
      id,
      PLAN_ID,
    )
    .run();
}

export async function deleteQuestion(id: string, role?: Role) {
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkspace(d1);

  const question = await d1
    .prepare("SELECT author_role FROM section_questions WHERE id = ? AND plan_id = ?")
    .bind(id, PLAN_ID)
    .first<{ author_role: Role }>();

  if (!question) {
    throw new Error("Question not found.");
  }

  const actingRole = normalize(role, allowedRoles, "Business Team");
  if (actingRole !== "Business Team" && actingRole !== question.author_role) {
    throw new Error("Only the submitting role or Business Team can delete this question.");
  }

  await d1.prepare("DELETE FROM section_questions WHERE id = ? AND plan_id = ?").bind(id, PLAN_ID).run();
}

export async function createApprover(input: { name?: string; title?: string; posture?: string; requesterEmail?: string }) {
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkspace(d1);
  await ensureApproverDefaults(d1);

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
      `${PLAN_ID}-approver-${slug(name)}-${now}`,
      PLAN_ID,
      name,
      input.title?.trim() || "Approver",
      input.posture?.trim() || "Reviewing",
      now,
    )
    .run();
}

export async function updateApprover(id: string, input: { posture?: string }) {
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkspace(d1);

  const posture = input.posture?.trim();
  if (!posture) {
    throw new Error("posture is required.");
  }

  const result = await d1
    .prepare("UPDATE approvers SET posture = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(posture, Date.now(), id, PLAN_ID)
    .run();

  if (!result.meta.rows_written) {
    throw new Error("Approver not found.");
  }
}

async function ensureSchema(d1: D1Database) {
  const statements = [
    "CREATE TABLE IF NOT EXISTS business_plans (id text PRIMARY KEY NOT NULL, title text NOT NULL, team_name text NOT NULL, approval_state text DEFAULT 'Draft' NOT NULL, approval_posture text DEFAULT 'Drafting' NOT NULL, created_by text, updated_at integer NOT NULL)",
    "CREATE TABLE IF NOT EXISTS memo_sections (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, section_key text NOT NULL, title text NOT NULL, position integer NOT NULL, content text DEFAULT '' NOT NULL, status text DEFAULT 'Draft' NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS section_questions (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, section_id text NOT NULL, author_name text NOT NULL, author_role text NOT NULL, visibility text DEFAULT 'Public' NOT NULL, status text DEFAULT 'Open' NOT NULL, issue_type text DEFAULT 'Clarification' NOT NULL, function_name text DEFAULT '' NOT NULL, body text NOT NULL, response text, created_at integer NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade, FOREIGN KEY (section_id) REFERENCES memo_sections(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS approvers (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, name text NOT NULL, title text NOT NULL, posture text DEFAULT 'Reviewing' NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
  ];

  for (const statement of statements) {
    await d1.prepare(statement).run();
  }

  await addColumnIfMissing(d1, "business_plans", "approval_state", "text DEFAULT 'Draft' NOT NULL");
  await addColumnIfMissing(d1, "business_plans", "approval_posture", "text DEFAULT 'Drafting' NOT NULL");
  await addColumnIfMissing(d1, "memo_sections", "section_key", "text");
  await addColumnIfMissing(d1, "section_questions", "issue_type", "text DEFAULT 'Clarification' NOT NULL");
  await addColumnIfMissing(d1, "section_questions", "function_name", "text DEFAULT '' NOT NULL");
  await backfillSectionKeys(d1);
}

async function ensureDefaultWorkspace(d1: D1Database) {
  const existing = await d1
    .prepare("SELECT id, title, team_name FROM business_plans WHERE id = ?")
    .bind(PLAN_ID)
    .first<{ id: string; title: string; team_name: string }>();

  if (existing) {
    if (existing.title.includes("[Team Name]") || !existing.team_name) {
      await d1
        .prepare("UPDATE business_plans SET title = ?, team_name = ?, updated_at = ? WHERE id = ?")
        .bind("2027 Essentials Business Plan", "Essentials", Date.now(), PLAN_ID)
        .run();
    }
    return;
  }

  const now = Date.now();
  await d1.batch([
    d1
      .prepare(
        "INSERT INTO business_plans (id, title, team_name, approval_state, approval_posture, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(PLAN_ID, "2027 Essentials Business Plan", "Essentials", "Draft", "Drafting", null, now),
    ...sectionDefaults.map((section, index) =>
      d1
        .prepare(
          "INSERT INTO memo_sections (id, plan_id, section_key, title, position, content, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(`${PLAN_ID}-${section.key}`, PLAN_ID, section.key, section.title, index + 1, section.content, section.status, now),
    ),
    ...approverDefaults.map((approver) =>
      d1
        .prepare(
          "INSERT INTO approvers (id, plan_id, name, title, posture, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(`${PLAN_ID}-approver-${slug(approver.name)}`, PLAN_ID, approver.name, approver.title, approver.posture, now),
    ),
  ]);
}

async function ensureApproverDefaults(d1: D1Database) {
  const rows = await d1
    .prepare("SELECT id, name FROM approvers WHERE plan_id = ?")
    .bind(PLAN_ID)
    .all<{ id: string; name: string }>();

  const existingNames = new Set((rows.results ?? []).map((row) => row.name));
  const statements = [];
  const now = Date.now();

  for (const name of placeholderApproverNames) {
    if (existingNames.has(name)) {
      statements.push(
        d1.prepare("DELETE FROM approvers WHERE plan_id = ? AND name = ?").bind(PLAN_ID, name),
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
          .bind(`${PLAN_ID}-approver-${slug(approver.name)}`, PLAN_ID, approver.name, approver.title, approver.posture, now),
      );
    }
  }

  statements.push(
    d1
      .prepare("UPDATE approvers SET posture = ?, updated_at = ? WHERE plan_id = ? AND posture IN (?, ?, ?)")
      .bind("Needs Revision", now, PLAN_ID, "Reviewing", "Needs answers", "Supportive"),
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

async function addColumnIfMissing(d1: D1Database, table: string, column: string, definition: string) {
  const rows = await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if ((rows.results ?? []).some((row) => row.name === column)) {
    return;
  }
  await d1.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

async function backfillSectionKeys(d1: D1Database) {
  const rows = await d1
    .prepare("SELECT id, title, position, section_key FROM memo_sections WHERE plan_id = ? ORDER BY position ASC")
    .bind(PLAN_ID)
    .all<{ id: string; title: string; position: number; section_key?: string | null }>();

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
      d1.prepare("UPDATE memo_sections SET section_key = ? WHERE id = ? AND plan_id = ?").bind(resolvedKey, row.id, PLAN_ID),
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
