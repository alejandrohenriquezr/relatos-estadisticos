CREATE TABLE `statistical_operation_config` (
	`operation` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`analysis` text DEFAULT 'on' NOT NULL,
	`publications` text DEFAULT 'off' NOT NULL,
	`documentation` text DEFAULT 'off' NOT NULL,
	`databases` text DEFAULT 'off' NOT NULL,
	`resources` text DEFAULT 'off' NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
