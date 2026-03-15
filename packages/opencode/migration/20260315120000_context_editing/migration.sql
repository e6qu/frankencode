CREATE TABLE `cas_object` (
	`hash` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`content_type` text NOT NULL,
	`tokens` integer NOT NULL,
	`session_id` text,
	`message_id` text,
	`part_id` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `cas_object_session_idx` ON `cas_object` (`session_id`);--> statement-breakpoint
CREATE TABLE `edit_graph_node` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`session_id` text NOT NULL,
	`part_id` text NOT NULL,
	`operation` text NOT NULL,
	`cas_hash` text,
	`agent` text NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `edit_graph_session_idx` ON `edit_graph_node` (`session_id`);--> statement-breakpoint
CREATE INDEX `edit_graph_parent_idx` ON `edit_graph_node` (`parent_id`);--> statement-breakpoint
CREATE TABLE `edit_graph_head` (
	`session_id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`branches` text
);--> statement-breakpoint
CREATE TABLE `side_thread` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `project`(`id`) ON DELETE CASCADE,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL DEFAULT 'parked',
	`priority` text NOT NULL DEFAULT 'medium',
	`category` text NOT NULL DEFAULT 'other',
	`source_session_id` text,
	`source_part_ids` text,
	`cas_refs` text,
	`related_files` text,
	`created_by` text NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `side_thread_project_idx` ON `side_thread` (`project_id`, `status`);
