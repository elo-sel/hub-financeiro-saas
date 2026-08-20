CREATE TABLE `bank_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`institution` varchar(120),
	`openingBalance` decimal(14,2) NOT NULL DEFAULT '0',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`productId` int NOT NULL,
	`planId` int,
	`code` varchar(80) NOT NULL,
	`billingCycle` enum('monthly','quarterly','annual') NOT NULL,
	`monthlyRecurringRevenue` decimal(14,2) NOT NULL DEFAULT '0',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`renewalDate` timestamp,
	`status` enum('active','paused','cancelled','expired') NOT NULL DEFAULT 'active',
	`paymentStatus` enum('current','overdue','unknown') NOT NULL DEFAULT 'unknown',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contracts_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `cost_centers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(40) NOT NULL,
	`kind` enum('cogs','opex','revenue','cash') NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_centers_id` PRIMARY KEY(`id`),
	CONSTRAINT `cost_centers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legalName` varchar(180) NOT NULL,
	`document` varchar(30),
	`email` varchar(320),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int,
	`year` int NOT NULL,
	`quarter` enum('Q1','Q2','Q3','Q4') NOT NULL,
	`targetNewCustomers` int NOT NULL DEFAULT 0,
	`targetMrr` decimal(14,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `goals_product_year_quarter_idx` UNIQUE(`productId`,`year`,`quarter`)
);
--> statement-breakpoint
CREATE TABLE `infrastructure_allocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`productId` int NOT NULL,
	`licenseId` int,
	`allocationMethod` enum('direct','active_license_count') NOT NULL,
	`allocationUnits` decimal(14,4) NOT NULL DEFAULT '0',
	`allocationRate` decimal(14,6) NOT NULL DEFAULT '0',
	`allocatedAmount` decimal(14,2) NOT NULL,
	`competenceMonth` varchar(7) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `infrastructure_allocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`licenseKey` varchar(100) NOT NULL,
	`activeSeats` int NOT NULL DEFAULT 1,
	`status` enum('active','suspended','cancelled') NOT NULL DEFAULT 'active',
	`activatedAt` timestamp NOT NULL DEFAULT (now()),
	`deactivatedAt` timestamp,
	CONSTRAINT `licenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `licenses_licenseKey_unique` UNIQUE(`licenseKey`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`defaultMonthlyPrice` decimal(14,2) NOT NULL DEFAULT '0',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_product_name_idx` UNIQUE(`productId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `saas_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`category` varchar(120),
	`description` text,
	`primaryProviderId` int,
	`sharedInfrastructure` boolean NOT NULL DEFAULT false,
	`sharedBaseMonthlyCost` decimal(14,2) NOT NULL DEFAULT '0',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saas_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_products_name_unique` UNIQUE(`name`),
	CONSTRAINT `saas_products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `infrastructure_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(40) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `infrastructure_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `infrastructure_providers_name_unique` UNIQUE(`name`),
	CONSTRAINT `infrastructure_providers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `tax_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`ratePercent` decimal(7,4) NOT NULL,
	`productId` int,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tax_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int,
	`customerId` int,
	`contractId` int,
	`providerId` int,
	`costCenterId` int,
	`bankAccountId` int,
	`type` enum('income','expense') NOT NULL,
	`category` varchar(120) NOT NULL,
	`description` varchar(240) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`competenceMonth` varchar(7) NOT NULL,
	`status` enum('confirmed','pending','cancelled') NOT NULL DEFAULT 'confirmed',
	`source` enum('manual','contract','import') NOT NULL DEFAULT 'manual',
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `contracts_product_status_idx` ON `contracts` (`productId`,`status`);--> statement-breakpoint
CREATE INDEX `contracts_customer_idx` ON `contracts` (`customerId`);--> statement-breakpoint
CREATE INDEX `customers_legal_name_idx` ON `customers` (`legalName`);--> statement-breakpoint
CREATE INDEX `infra_alloc_transaction_idx` ON `infrastructure_allocations` (`transactionId`);--> statement-breakpoint
CREATE INDEX `infra_alloc_license_idx` ON `infrastructure_allocations` (`licenseId`);--> statement-breakpoint
CREATE INDEX `infra_alloc_month_idx` ON `infrastructure_allocations` (`competenceMonth`);--> statement-breakpoint
CREATE INDEX `saas_products_name_idx` ON `saas_products` (`name`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `financial_transactions` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `transactions_product_date_idx` ON `financial_transactions` (`productId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `financial_transactions` (`type`);