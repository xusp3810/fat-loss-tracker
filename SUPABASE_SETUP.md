# Supabase 云同步配置

## 前端配置

复制示例配置：

```bash
copy supabase-config.example.js supabase-config.js
```

然后把 `supabase-config.js` 改成你的 Supabase 项目信息：

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_PUBLIC_KEY"
};
```

只使用 `anon public key`。不要把 `service_role` key 写进前端。

如果部署到 Vercel，静态站点没有构建注入流程时，建议在部署环境中生成同名 `supabase-config.js`，或改成你自己的构建脚本生成该文件。

## records 表

在 Supabase SQL Editor 执行：

```sql
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day integer,
  date date,
  weight numeric(6, 2),
  waist numeric(6, 2),
  training_part text,
  training_actions text,
  cardio text,
  is_rest_day boolean not null default false,
  is_paused boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.records
drop constraint if exists records_user_day_unique;

drop index if exists public.records_user_day_unique;

alter table public.records
add constraint records_user_day_unique unique (user_id, day);

alter table public.records enable row level security;
```

## updated_at 自动更新

```sql
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists records_set_updated_at on public.records;

create trigger records_set_updated_at
before update on public.records
for each row
execute function public.set_updated_at();
```

## RLS 策略

```sql
drop policy if exists "Users can read own records" on public.records;
drop policy if exists "Users can insert own records" on public.records;
drop policy if exists "Users can update own records" on public.records;
drop policy if exists "Users can delete own records" on public.records;

create policy "Users can read own records"
on public.records
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own records"
on public.records
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own records"
on public.records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own records"
on public.records
for delete
to authenticated
using (auth.uid() = user_id);
```

## 同步行为

- 未配置 Supabase：App 继续使用 localStorage 本地模式。
- 未登录：可正常本地记录，页面提示“登录后可云同步”。
- 登录后：拉取当前用户的 `records`。
- 首次登录且本地有数据：提示是否上传本地数据到云端。
- 新增、编辑、删除记录后：同步写入 Supabase。
- RLS 保证每个用户只能访问自己的记录。

## 修复 ON CONFLICT(user_id, day) 报错

如果遇到：

```text
there is no unique or exclusion constraint matching the ON CONFLICT specification
```

说明 `records_user_day_unique` 没有作为非 partial 的唯一约束存在。请在 SQL Editor 执行：

```sql
-- 1. 检查 records 表字段
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'records'
order by ordinal_position;

-- 2. 检查唯一约束/索引是否存在
select
  c.conname as constraint_name,
  c.contype as constraint_type,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'records';

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'records';

-- 3. 删除可能存在的 partial index，并创建 ON CONFLICT 可匹配的唯一约束
alter table public.records
drop constraint if exists records_user_day_unique;

drop index if exists public.records_user_day_unique;

-- 如果已有重复 user_id + day，需要先清理重复数据。
-- 下面保留 updated_at/created_at 最新的一条，删除较旧重复项。
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, day
      order by updated_at desc nulls last, created_at desc nulls last
    ) as rn
  from public.records
  where day is not null
)
delete from public.records r
using ranked
where r.id = ranked.id
  and ranked.rn > 1;

alter table public.records
add constraint records_user_day_unique unique (user_id, day);

-- 4. 确认约束创建成功
select
  c.conname as constraint_name,
  c.contype as constraint_type,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'records'
  and c.conname = 'records_user_day_unique';
```
