CREATE TABLE IF NOT EXISTS `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_role` text NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`action` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `collaborative_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`group_type` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'General Reader' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
