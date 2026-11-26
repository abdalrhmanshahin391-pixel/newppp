-- Read-only acceptance checks for the uploaded uzyra_plans.sql update.
-- Run against the connected database; every row must report passed = true.
with expected(slug,cents,seconds,period,requests) as (values
  ('starter',0,600,'lifetime',30),
  ('uzyra',2300,1800,'daily',1000),
  ('uzyra_plus',3000,2400,'daily',1500),
  ('uzyra_pro',4000,3000,'daily',2000),
  ('uzyra_max',5000,3600,'daily',3000)
)
select e.slug as rule, coalesce(p.price_cents=e.cents
  and p.free_talk_seconds=e.seconds and p.free_talk_period=e.period
  and p.max_groq_requests=e.requests and p.published
  and (e.slug='starter' or p.billing_months=1),false) as passed
from expected e left join public.plans p using(slug)
union all
select 'legacy plans hidden', count(*)=5 and bool_and(not published)
from public.plans where slug in ('toolkit','study','boost','pro','ultimate')
union all
select 'usage RLS enabled', coalesce((select relrowsecurity from pg_class
  where oid=to_regclass('public.groq_request_usage')),false)
union all
select 'usage private', not has_table_privilege('anon','public.groq_request_usage','SELECT')
  and not has_table_privilege('authenticated','public.groq_request_usage','SELECT')
  and not has_table_privilege('authenticated','public.groq_request_usage','UPDATE')
union all
select 'caller-only request function',
  has_function_privilege('authenticated','public.groq_request_take()','EXECUTE')
  and not has_function_privilege('anon','public.groq_request_take()','EXECUTE')
  and not has_function_privilege('authenticated','public.groq_request_take_for(uuid)','EXECUTE')
union all
select 'voice reservation server-only',
  has_function_privilege('service_role','public.free_talk_reserve(uuid,uuid,boolean)','EXECUTE')
  and not has_function_privilege('authenticated','public.free_talk_reserve(uuid,uuid,boolean)','EXECUTE')
  and not has_function_privilege('anon','public.free_talk_reserve(uuid,uuid,boolean)','EXECUTE');