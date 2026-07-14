ALTER TABLE `memo_sections` ADD `current_version_id` text;
--> statement-breakpoint
CREATE TABLE `memo_section_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL,
  `section_id` text NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL,
  `created_by_email` text NOT NULL,
  `created_by_name` text NOT NULL,
  `action_type` text DEFAULT 'edit' NOT NULL,
  `source_version_id` text,
  `note` text DEFAULT '' NOT NULL,
  FOREIGN KEY (`plan_id`) REFERENCES `business_plans`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`section_id`) REFERENCES `memo_sections`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_version_id`) REFERENCES `memo_section_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `memo_section_versions_section_created_idx` ON `memo_section_versions` (`section_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `memo_section_versions_plan_created_idx` ON `memo_section_versions` (`plan_id`, `created_at`);
