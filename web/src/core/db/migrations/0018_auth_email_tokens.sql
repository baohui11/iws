CREATE TABLE "auth_email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "auth_email_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "auth_email_tokens" ADD CONSTRAINT "auth_email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_auth_email_tokens_user_purpose_expires" ON "auth_email_tokens" USING btree ("user_id","purpose","expires_at");
--> statement-breakpoint
CREATE INDEX "idx_auth_email_tokens_token_hash" ON "auth_email_tokens" USING btree ("token_hash");
