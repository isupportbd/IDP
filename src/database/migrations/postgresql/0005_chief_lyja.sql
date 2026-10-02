CREATE TABLE "sms_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"recipient_mobile" varchar(32) NOT NULL,
	"message" text NOT NULL,
	"template_key" varchar(64),
	"submission_id" varchar(64),
	"status" varchar(32) DEFAULT 'SENT' NOT NULL,
	"provider_response" text,
	"sent_by" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"key" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_heads" DROP CONSTRAINT "expense_heads_name_unique";--> statement-breakpoint
ALTER TABLE "expense_heads" DROP CONSTRAINT "expense_heads_code_unique";--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "company_name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "proprietor_name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "phone" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "email" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "website" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "address" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "bin_number" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "tin_number" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "trade_license_no" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "receipt_prefix" SET DEFAULT 'RCP';--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "sms_sender_id" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "admin_id" integer;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "admin_id" integer;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sms_provider" varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sms_endpoint_url" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "expense_heads" ADD COLUMN "admin_id" integer;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_logs_admin_id_idx" ON "sms_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "sms_logs_sent_at_idx" ON "sms_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "sms_logs_status_idx" ON "sms_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sms_templates_admin_key_idx" ON "sms_templates" USING btree ("admin_id","key");--> statement-breakpoint
CREATE INDEX "sms_templates_key_idx" ON "sms_templates" USING btree ("key");--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_heads" ADD CONSTRAINT "expense_heads_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_rates_lookup_idx" ON "sales_rates" USING btree ("client_id","item_id","status","activation_date");--> statement-breakpoint
CREATE INDEX "company_settings_admin_id_idx" ON "company_settings" USING btree ("admin_id");