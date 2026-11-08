-- إحصائيات حجم قاعدة البيانات للوحة الإدارة (للقراءة من الخادم فقط)
create or replace function public.db_size_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_bytes', pg_database_size(current_database()),
    'tables', coalesce((
      select json_agg(t) from (
        select c.relname as name,
               pg_total_relation_size(c.oid) as bytes,
               greatest(c.reltuples, 0)::bigint as rows
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 40
      ) t
    ), '[]'::json)
  );
$$;

revoke all on function public.db_size_stats() from public, anon, authenticated;
grant execute on function public.db_size_stats() to service_role;
