import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const businessPlans = sqliteTable("business_plans", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  teamName: text("team_name").notNull().default("Team"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const memoSections = sqliteTable("memo_sections", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  requirement: text("requirement").notNull(),
  content: text("content").notNull().default(""),
  status: text("status", { enum: ["Draft", "Review", "Approved"] })
    .notNull()
    .default("Draft"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sectionComments = sqliteTable("section_comments", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id),
  sectionId: text("section_id")
    .notNull()
    .references(() => memoSections.id),
  author: text("author").notNull(),
  role: text("role", { enum: ["business", "enablement", "approver"] }).notNull(),
  body: text("body").notNull(),
  visibility: text("visibility", {
    enum: ["Public", "Draft", "Private"],
  }).notNull(),
  status: text("status", {
    enum: ["Open", "Acknowledged", "Resolved"],
  })
    .notNull()
    .default("Open"),
  response: text("response").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const approvalPostures = sqliteTable("approval_postures", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => businessPlans.id),
  sectionId: text("section_id").references(() => memoSections.id),
  approver: text("approver").notNull(),
  posture: text("posture", {
    enum: ["Needs clarification", "Ready", "Approved"],
  }).notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
