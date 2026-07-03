CREATE TABLE IF NOT EXISTS "oa_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"pulled_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"unchanged_count" integer DEFAULT 0 NOT NULL,
	"deleted_count" integer DEFAULT 0 NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"warnings" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_oa_sync_runs_scope_started" ON "oa_sync_runs" USING btree ("scope","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_oa_sync_runs_status_started" ON "oa_sync_runs" USING btree ("status","started_at");--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('pgmq.q_oa_sync') IS NULL THEN
    PERFORM pgmq.create('oa_sync');
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iws_oa_sync_departments') THEN
      PERFORM cron.schedule(
        'iws_oa_sync_departments',
        '0 2 * * *',
        'select pgmq.send(''oa_sync''::text, ''{"scope":"departments","trigger":"cron"}''::jsonb)'
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iws_oa_sync_users') THEN
      PERFORM cron.schedule(
        'iws_oa_sync_users',
        '10 2 * * *',
        'select pgmq.send(''oa_sync''::text, ''{"scope":"users","trigger":"cron"}''::jsonb)'
      );
    END IF;
  END IF;
END $$;--> statement-breakpoint
