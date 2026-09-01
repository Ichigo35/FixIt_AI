CREATE TABLE "app_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"diagnoses_used" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" text,
	"brand" text,
	"model" text,
	"serial_number" text,
	"user_description" text DEFAULT '' NOT NULL,
	"problem" text NOT NULL,
	"confidence" real NOT NULL,
	"severity" text NOT NULL,
	"difficulty" text NOT NULL,
	"risk_level" text NOT NULL,
	"recommendation" text NOT NULL,
	"needs_professional" boolean NOT NULL,
	"forced_stop" boolean NOT NULL,
	"repairability_score" integer NOT NULL,
	"repairability_label" text NOT NULL,
	"estimated_time_min" integer,
	"estimated_cost_min" real,
	"estimated_cost_max" real,
	"cost_currency" text,
	"raw_diagnosis" jsonb NOT NULL,
	"safety" jsonb NOT NULL,
	"ai_provider" text NOT NULL,
	"ai_model" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnosis_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"kind" text DEFAULT 'problem' NOT NULL,
	"content_type" text,
	"bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_guides" (
	"diagnosis_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"ai_provider" text NOT NULL,
	"ai_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"outcome" text NOT NULL,
	"before_r2_key" text,
	"after_r2_key" text,
	"feedback_worked" boolean,
	"feedback_note" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_images" ADD CONSTRAINT "diagnosis_images_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_guides" ADD CONSTRAINT "repair_guides_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_history" ADD CONSTRAINT "repair_history_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_history" ADD CONSTRAINT "repair_history_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diagnoses_user_created_idx" ON "diagnoses" USING btree ("user_id","created_at" DESC NULLS LAST);