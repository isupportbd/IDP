CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_name" varchar(150) NOT NULL,
	"account_name" varchar(150) NOT NULL,
	"account_number" varchar(100) NOT NULL,
	"branch_name" varchar(150),
	"routing_number" varchar(50),
	"bkash_number" varchar(50),
	"nagad_number" varchar(50),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) DEFAULT 'ASSOCIATES & CO. VAT & TAX CONSULTANCY' NOT NULL,
	"proprietor_name" varchar(255) DEFAULT 'Advocate Md. Ruhul Amin',
	"phone" varchar(50) DEFAULT '+880 1819-234567',
	"email" varchar(255) DEFAULT 'billing@associatesvat.com',
	"website" varchar(255) DEFAULT 'https://associatesvat.com',
	"address" text DEFAULT 'Suite # 504, City Heart Building, 67 Naya Paltan, VIP Road, Dhaka-1000',
	"bin_number" varchar(50) DEFAULT '001234567-0101',
	"tin_number" varchar(50) DEFAULT '782910384721',
	"trade_license_no" varchar(100) DEFAULT 'TRAD/DSCC/038291',
	"invoice_prefix" varchar(20) DEFAULT 'INV',
	"invoice_terms" text DEFAULT '1. Payment is due within 15 days of invoice date.
2. Please mention the invoice number as reference in payment.
3. Checks/Transfers are subject to realization.',
	"receipt_prefix" varchar(20) DEFAULT 'MR',
	"auto_due_carry_forward" boolean DEFAULT true NOT NULL,
	"bin_unique_enforcement" boolean DEFAULT true NOT NULL,
	"allow_duplicate_mobile" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_heads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(50),
	"category" varchar(100) DEFAULT 'Operational' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_heads_name_unique" UNIQUE("name"),
	CONSTRAINT "expense_heads_code_unique" UNIQUE("code")
);
