CREATE TABLE "client_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"email" varchar(255),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_references_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "reference_id" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_reference_id_client_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."client_references"("id") ON DELETE set null ON UPDATE cascade;