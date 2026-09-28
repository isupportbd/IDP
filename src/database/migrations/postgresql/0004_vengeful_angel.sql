CREATE TABLE "bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"service_item_id" integer,
	"item_name" varchar(255) NOT NULL,
	"unit" varchar(50) DEFAULT 'Month',
	"qty" double precision DEFAULT 1 NOT NULL,
	"rate_used" double precision DEFAULT 0 NOT NULL,
	"minimum_charge_used" double precision DEFAULT 0 NOT NULL,
	"calculated_amount" double precision DEFAULT 0 NOT NULL,
	"final_amount" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_no" varchar(50) NOT NULL,
	"client_id" integer NOT NULL,
	"reference_id" integer,
	"tax_period" varchar(10) NOT NULL,
	"bill_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount_amount" double precision DEFAULT 0 NOT NULL,
	"previous_due" double precision DEFAULT 0 NOT NULL,
	"grand_total" double precision DEFAULT 0 NOT NULL,
	"paid_amount" double precision DEFAULT 0 NOT NULL,
	"due_amount" double precision DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'unpaid' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_bill_no_unique" UNIQUE("bill_no")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_no" varchar(50) NOT NULL,
	"bill_id" integer,
	"client_id" integer NOT NULL,
	"collection_date" timestamp with time zone NOT NULL,
	"amount" double precision NOT NULL,
	"payment_method" varchar(50) DEFAULT 'cash' NOT NULL,
	"reference_no" varchar(100),
	"notes" text,
	"received_by" integer,
	"status" varchar(30) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_receipt_no_unique" UNIQUE("receipt_no")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer DEFAULT 1 NOT NULL,
	"client_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"office" varchar(100),
	"be_no" varchar(100),
	"be_date" date NOT NULL,
	"month" varchar(7) NOT NULL,
	"lc_number" varchar(100),
	"net_wt" double precision NOT NULL,
	"excess_qty" double precision,
	"total_qty" double precision,
	"ass_value" double precision NOT NULL,
	"unit_value" double precision,
	"cd" double precision,
	"rd" double precision,
	"sd" double precision,
	"base_value_of_vat" double precision,
	"vat" double precision,
	"at" double precision,
	"is_rebate" boolean DEFAULT false,
	"is_ffs" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer DEFAULT 1 NOT NULL,
	"client_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"unit_id" integer,
	"sales_rate" double precision NOT NULL,
	"vat_rate" double precision NOT NULL,
	"vatable_value" double precision NOT NULL,
	"addition_percent" double precision DEFAULT 0,
	"activation_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vat_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"tax_period" varchar(20) NOT NULL,
	"submission_id" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'submitted' NOT NULL,
	"submitted_by" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "column_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"db_column" varchar(100) NOT NULL,
	"label" varchar(100) NOT NULL,
	"excel_header" varchar(255),
	"is_calculated" boolean DEFAULT false NOT NULL,
	"is_from_db" boolean DEFAULT false NOT NULL,
	"is_regex_extracted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "column_mappings_db_column_unique" UNIQUE("db_column")
);
--> statement-breakpoint
CREATE TABLE "global_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"hs_code" varchar(50) NOT NULL,
	"aw_hs_code" varchar(50),
	"name" varchar(255) NOT NULL,
	"unit" varchar(50) DEFAULT 'U' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"postal_code" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "measurement_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payment_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bkash_number" varchar(50) DEFAULT '01719950891' NOT NULL,
	"bkash_charge" double precision DEFAULT 1.8 NOT NULL,
	"nagad_number" varchar(50),
	"rocket_number" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"rate_monthly" double precision NOT NULL,
	"rate_yearly" double precision NOT NULL,
	"max_users" integer DEFAULT 1 NOT NULL,
	"max_clients" integer DEFAULT 50 NOT NULL,
	"max_storage_mb" integer DEFAULT 1024 NOT NULL,
	"has_accounts" boolean DEFAULT false NOT NULL,
	"yearly_discount_percent" double precision DEFAULT 0 NOT NULL,
	"features" json DEFAULT '[]'::json,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"plan_id" integer,
	"type" varchar(30) DEFAULT 'deposit' NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL,
	"gross_amount" integer DEFAULT 0 NOT NULL,
	"gateway_charge" double precision DEFAULT 0 NOT NULL,
	"net_amount" integer DEFAULT 0 NOT NULL,
	"plan_rate" integer DEFAULT 0 NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"excess_credit" integer DEFAULT 0 NOT NULL,
	"trx_id" varchar(100),
	"payment_method" varchar(50) DEFAULT 'bkash' NOT NULL,
	"days_added" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_unit" varchar(50) NOT NULL,
	"sales_unit" varchar(50) NOT NULL,
	"factor" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vat_notes_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"vat_rate" double precision NOT NULL,
	"note_name" varchar(50) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vat_notes_mapping_vat_rate_unique" UNIQUE("vat_rate")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mobile" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_cycle" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trx_id" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paid_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "advance_balance" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sms_balance" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "exp_date" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "extra_storage_mb" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sms_api_key" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sms_sender_id" varchar(50) DEFAULT 'VAT-IDP';--> statement-breakpoint
ALTER TABLE "service_rates" ADD COLUMN "unit" varchar(50) DEFAULT 'Month' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "opening_balance" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_service_item_id_service_items_id_fk" FOREIGN KEY ("service_item_id") REFERENCES "public"."service_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_reference_id_client_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."client_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_item_id_global_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."global_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_rates" ADD CONSTRAINT "sales_rates_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_rates" ADD CONSTRAINT "sales_rates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_rates" ADD CONSTRAINT "sales_rates_item_id_global_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."global_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_rates" ADD CONSTRAINT "sales_rates_unit_id_unit_conversions_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit_conversions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_submissions" ADD CONSTRAINT "vat_submissions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vat_submissions" ADD CONSTRAINT "vat_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "commercial_areas" ADD CONSTRAINT "commercial_areas_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_transactions" ADD CONSTRAINT "subscription_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subscription_transactions" ADD CONSTRAINT "subscription_transactions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "bill_items_bill_id_idx" ON "bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_items_service_item_id_idx" ON "bill_items" USING btree ("service_item_id");--> statement-breakpoint
CREATE INDEX "bills_client_tax_period_idx" ON "bills" USING btree ("client_id","tax_period");--> statement-breakpoint
CREATE INDEX "bills_tax_period_status_idx" ON "bills" USING btree ("tax_period","status");--> statement-breakpoint
CREATE INDEX "bills_bill_no_idx" ON "bills" USING btree ("bill_no");--> statement-breakpoint
CREATE INDEX "bills_created_by_idx" ON "bills" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "collections_client_status_idx" ON "collections" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "collections_bill_id_idx" ON "collections" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "collections_receipt_no_idx" ON "collections" USING btree ("receipt_no");--> statement-breakpoint
CREATE INDEX "collections_date_idx" ON "collections" USING btree ("collection_date");--> statement-breakpoint
CREATE INDEX "collections_received_by_idx" ON "collections" USING btree ("received_by");--> statement-breakpoint
CREATE INDEX "purchases_admin_id_idx" ON "purchases" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "purchases_client_id_idx" ON "purchases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "purchases_item_id_idx" ON "purchases" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "purchases_month_idx" ON "purchases" USING btree ("month");--> statement-breakpoint
CREATE INDEX "purchases_admin_month_idx" ON "purchases" USING btree ("admin_id","month");--> statement-breakpoint
CREATE INDEX "purchases_client_month_idx" ON "purchases" USING btree ("client_id","month");--> statement-breakpoint
CREATE INDEX "purchases_be_no_date_idx" ON "purchases" USING btree ("be_no","be_date");--> statement-breakpoint
CREATE INDEX "purchases_client_be_date_idx" ON "purchases" USING btree ("client_id","be_date");--> statement-breakpoint
CREATE INDEX "sales_rates_admin_id_idx" ON "sales_rates" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "sales_rates_client_id_idx" ON "sales_rates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "sales_rates_item_id_idx" ON "sales_rates" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "sales_rates_client_status_idx" ON "sales_rates" USING btree ("client_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "vat_submissions_client_tax_period_idx" ON "vat_submissions" USING btree ("client_id","tax_period");--> statement-breakpoint
CREATE INDEX "vat_submissions_tax_period_idx" ON "vat_submissions" USING btree ("tax_period");--> statement-breakpoint
CREATE INDEX "vat_submissions_submitted_by_idx" ON "vat_submissions" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "vat_submissions_status_idx" ON "vat_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "global_items_hs_code_idx" ON "global_items" USING btree ("hs_code");--> statement-breakpoint
CREATE INDEX "global_items_aw_hs_code_idx" ON "global_items" USING btree ("aw_hs_code");--> statement-breakpoint
CREATE INDEX "global_items_is_active_idx" ON "global_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "global_items_name_idx" ON "global_items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "unit_conversions_units_idx" ON "unit_conversions" USING btree ("purchase_unit","sales_unit");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_admin_id_idx" ON "users" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "users_role_id_idx" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_rates_item_type_idx" ON "service_rates" USING btree ("service_item_id","customer_type_id");--> statement-breakpoint
CREATE INDEX "clients_created_by_active_idx" ON "clients" USING btree ("created_by","is_active");--> statement-breakpoint
CREATE INDEX "clients_bin_number_idx" ON "clients" USING btree ("bin_number");--> statement-breakpoint
CREATE INDEX "clients_customer_type_id_idx" ON "clients" USING btree ("customer_type_id");--> statement-breakpoint
CREATE INDEX "clients_reference_id_idx" ON "clients" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "clients_company_name_idx" ON "clients" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "client_managers_client_mgr_idx" ON "client_managers" USING btree ("client_id","manager_id");--> statement-breakpoint
CREATE INDEX "client_managers_manager_id_idx" ON "client_managers" USING btree ("manager_id");