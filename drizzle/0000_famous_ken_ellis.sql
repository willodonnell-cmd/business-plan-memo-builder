CREATE TABLE IF NOT EXISTS `business_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`team_name` text NOT NULL,
	`approval_state` text DEFAULT 'Draft' NOT NULL,
	`approval_posture` text DEFAULT 'Drafting' NOT NULL,
	`created_by` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `approvers` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`posture` text DEFAULT 'Reviewing' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `memo_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`section_key` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `section_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`section_id` text NOT NULL,
	`author_name` text NOT NULL,
	`author_role` text NOT NULL,
	`visibility` text DEFAULT 'Public' NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`issue_type` text DEFAULT 'Clarification' NOT NULL,
	`function_name` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`response` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `memo_sections`(`id`) ON UPDATE no action ON DELETE cascade
);
