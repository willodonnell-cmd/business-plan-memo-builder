import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const businessPlans = sqliteTable("business_plans", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  teamName: text("team_name").notNull(),
  approvalState: text("approval_state", { enum: ["Draft", "Review", "Approved"] })
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
  status: text("status", { enum: ["Draft", "Review", "Approved"] }).notNull().default("Draft"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
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
    enum: ["", "Legal", "HR", "Marketing", "IT", "Customer Account Management", "Other"],
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
