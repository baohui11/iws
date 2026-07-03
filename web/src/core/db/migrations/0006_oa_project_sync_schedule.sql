DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iws_oa_sync_projects') THEN
      PERFORM cron.schedule(
        'iws_oa_sync_projects',
        '20 2 * * *',
        'select pgmq.send(''oa_sync''::text, ''{"scope":"projects","trigger":"cron"}''::jsonb)'
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iws_oa_sync_project_roles') THEN
      PERFORM cron.schedule(
        'iws_oa_sync_project_roles',
        '30 2 * * *',
        'select pgmq.send(''oa_sync''::text, ''{"scope":"project_roles","trigger":"cron"}''::jsonb)'
      );
    END IF;
  END IF;
END $$;
