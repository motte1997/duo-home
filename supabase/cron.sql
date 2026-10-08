-- =====================================================================
-- Erinnerungen per Zeitplan (alle 15 Minuten)
-- VORAUSSETZUNG: Edge Function "send-push" ist deployt (siehe README).
-- Ersetze DEIN-PROJEKT-REF und DEIN-CRON-SECRET (dasselbe Secret wie bei
-- "supabase secrets set CRON_SECRET=...").
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Falls schon vorhanden: erst entfernen
select cron.unschedule('duo-reminders')
 where exists (select 1 from cron.job where jobname = 'duo-reminders');

select cron.schedule(
  'duo-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://DEIN-PROJEKT-REF.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', 'DEIN-CRON-SECRET'
               ),
    body    := '{"kind":"cron"}'::jsonb
  );
  $$
);
