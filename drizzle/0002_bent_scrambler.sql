CREATE TABLE `investment_request_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`line_type` text NOT NULL,
	`position` integer NOT NULL,
	`line_data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `investment_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `investment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`request_type` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`owner_name` text DEFAULT '' NOT NULL,
	`owner_email` text DEFAULT '' NOT NULL,
	`initiative` text DEFAULT '' NOT NULL,
	`strategic_objective` text DEFAULT '' NOT NULL,
	`milestone` text DEFAULT '' NOT NULL,
	`alternatives` text DEFAULT '' NOT NULL,
	`measurable_outcome` text DEFAULT '' NOT NULL,
	`not_approved_impact` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`submitted_at` integer,
	FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
