DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iws_oa_sync_departments') THEN
      PERFORM cron.unschedule('iws_oa_sync_departments');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iws_oa_sync_users') THEN
      PERFORM cron.unschedule('iws_oa_sync_users');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iws_oa_sync_projects') THEN
      PERFORM cron.unschedule('iws_oa_sync_projects');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'iws_oa_sync_project_roles') THEN
      PERFORM cron.unschedule('iws_oa_sync_project_roles');
    END IF;
  END IF;
END $$;
