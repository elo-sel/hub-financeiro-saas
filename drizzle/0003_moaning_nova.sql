ALTER TABLE `financial_invoices` ADD `fileKey` varchar(255);--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `fileName` varchar(255);--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `fileSize` int;--> statement-breakpoint
ALTER TABLE `financial_invoices` ADD `fileContentType` varchar(100);