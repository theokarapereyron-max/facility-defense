CREATE TABLE `player_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`username` text NOT NULL,
	`username_key` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar` text DEFAULT 'soldier' NOT NULL,
	`avatar_key` text,
	`created_at` integer NOT NULL,
	`disabled_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_accounts_public_id_uq` ON `player_accounts` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_accounts_username_uq` ON `player_accounts` (`username_key`);--> statement-breakpoint
CREATE TABLE `player_rate_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `player_rate_limits_expiry_idx` ON `player_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `player_recovery_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `player_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_recovery_account_idx` ON `player_recovery_codes` (`account_id`);--> statement-breakpoint
CREATE TABLE `player_results` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`mode` text DEFAULT 'solo' NOT NULL,
	`outcome` text NOT NULL,
	`active_seconds` integer NOT NULL,
	`eliminations` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `player_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_results_account_idx` ON `player_results` (`account_id`);--> statement-breakpoint
CREATE TABLE `player_saves` (
	`account_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data_version` integer DEFAULT 1 NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `player_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `player_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_sessions_account_idx` ON `player_sessions` (`account_id`);--> statement-breakpoint
CREATE INDEX `player_sessions_expiry_idx` ON `player_sessions` (`expires_at`);