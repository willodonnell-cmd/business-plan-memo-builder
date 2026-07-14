import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const businessPlans = sqliteTable("business_plans", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  teamName: text("team_name").notNull(),
  approvalState: text("approval_state", { enum: ["Draft", "Review", "Approval", "Approved"] })
    .notNull()
    .default("Draft"),
  approvalPosture: text("approval_posture").notNull().default("Drafting"),
  createdBy: text("created_by"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const memoSections = sqliteTable("memo_sections", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id, { onDelete: "cascade" }),
  sectionKey: text("section_key").notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  content: text("content").notNull().default(""),
  status: text("status", { enum: ["Draft", "Review", "Approval", "Approved"] }).notNull().default("Draft"),
  currentVersionId: text("current_version_id"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const memoSectionVersions = sqliteTable("memo_section_versions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id, { onDelete: "cascade" }),
  sectionId: text("section_id")
    .notNull()
    .references(() => memoSections.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  createdByEmail: text("created_by_email").notNull(),
  createdByName: text("created_by_name").notNull(),
  actionType: text("action_type", { enum: ["edit", "restore"] }).notNull().default("edit"),
  sourceVersionId: text("source_version_id"),
  note: text("note").notNull().default(""),
});

export const sectionQuestions = sqliteTable("section_questions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id, { onDelete: "cascade" }),
  sectionId: text("section_id")
    .notNull()
    .references(() => memoSections.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role", { enum: ["Business Team", "Enablement", "Approver"] }).notNull(),
  visibility: text("visibility", { enum: ["Public", "Draft", "Private"] }).notNull().default("Public"),
  status: text("status", { enum: ["Open", "Answered", "Resolved", "Reopened", "No Change Needed"] }).notNull().default("Open"),
  issueType: text("issue_type", {
    enum: [
      "Clarification",
      "Functional Dependency",
      "Support Need",
      "Risk / Constraint",
      "Required Input",
      "Approval Concern",
    ],
  })
    .notNull()
    .default("Clarification"),
  functionName: text("function_name", {
    enum: ["", "HR", "Legal", "IT", "Finance & Accounting", "Tax", "Marketing", "CLS", "Other"],
  })
    .notNull()
    .default(""),
  body: text("body").notNull(),
  response: text("response"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const approvers = sqliteTable("approvers", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  title: text("title").notNull(),
  posture: text("posture").notNull().default("Reviewing"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const userProfiles = sqliteTable("user_profiles", {
  email: text("email").primaryKey(),
  displayName: text("display_name"),
  role: text("role", { enum: ["Business Team", "Enablement", "Approver", "General Reader"] })
    .notNull()
    .default("General Reader"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const collaborativeGroups = sqliteTable("collaborative_groups", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id, { onDelete: "cascade" }),
  groupType: text("group_type", { enum: ["Enablement", "Advisor"] }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id, { onDelete: "cascade" }),
  actorEmail: text("actor_email").notNull(),
  actorRole: text("actor_role", { enum: ["Business Team", "Enablement", "Approver", "General Reader"] }).notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  action: text("action").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const investmentRequests = sqliteTable("investment_requests", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id, { onDelete: "cascade" }),
  requestType: text("request_type", { enum: ["Payroll / Headcount", "Non-Payroll"] }).notNull(),
  status: text("status", { enum: ["Draft", "Submitted"] }).notNull().default("Draft"),
  ownerName: text("owner_name").notNull().default(""),
  ownerEmail: text("owner_email").notNull().default(""),
  initiative: text("initiative").notNull().default(""),
  strategicObjective: text("strategic_objective").notNull().default(""),
  milestone: text("milestone").notNull().default(""),
  alternatives: text("alternatives").notNull().default(""),
  measurableOutcome: text("measurable_outcome").notNull().default(""),
  notApprovedImpact: text("not_approved_impact").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
});

export const investmentRequestLines = sqliteTable("investment_request_lines", {
  id: text("id").primaryKey(),
  requestId: text("request_id")
    .notNull()
    .references(() => investmentRequests.id, { onDelete: "cascade" }),
  lineType: text("line_type", { enum: ["Payroll / Headcount", "Non-Payroll"] }).notNull(),
  position: integer("position").notNull(),
  lineData: text("line_data", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
