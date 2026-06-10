CREATE TABLE `approval_postures` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`section_id` text,
	`approver` text NOT NULL,
	`posture` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `memo_sections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `business_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memo_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`requirement` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `section_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`section_id` text NOT NULL,
	`author` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`visibility` text NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `memo_sections`(`id`) ON UPDATE no action ON DELETE no action
);
