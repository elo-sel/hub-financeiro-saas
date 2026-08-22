ALTER TABLE `financial_invoices` ADD `extractionStatus` enum('pending','completed','failed','reviewed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `extractedAmount` decimal(14,2);--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `extractedIssueDate` timestamp;--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `extractedIssuerDocument` varchar(30);--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `extractedRecipientDocument` varchar(30);--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `extractedSupplierName` varchar(255);--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `extractionConfidence` decimal(5,2);--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `extractionRaw` text;