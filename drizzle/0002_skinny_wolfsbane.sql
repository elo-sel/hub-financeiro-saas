CREATE TABLE `financial_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`number` varchar(40) NOT NULL,
	`series` varchar(20),
	`issueDate` timestamp NOT NULL,
	`accessKey` varchar(44),
	`issuerDocument` varchar(30),
	`recipientDocument` varchar(30),
	`status` enum('issued','cancelled','pending') NOT NULL DEFAULT 'issued',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `financial_invoices_transactionId_unique` UNIQUE(`transactionId`),
	CONSTRAINT `invoices_access_key_idx` UNIQUE(`accessKey`)
);
--> statement-breakpoint
CREATE INDEX `invoices_transaction_idx` ON `financial_invoices` (`transactionId`);