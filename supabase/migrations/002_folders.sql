-- 遷移 002：卡片資料夾（#8）
-- 既有專案在 Supabase → SQL Editor 執行這整段即可（重跑也安全）。

-- 卡片新增所屬資料夾欄位
alter table public.cards add column if not exists "folderId" text;

-- 資料夾資料表
create table if not exists public.folders (
  id text primary key,
  name text not null default '',
  "createdAt" bigint not null,
  "updatedAt" bigint not null,
  user_id uuid not null default auth.uid(),
  client_id text
);

-- Row Level Security：只有本人讀寫
alter table public.folders enable row level security;
drop policy if exists "owner_all" on public.folders;
create policy "owner_all" on public.folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.folders replica identity full;

-- 加入 Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.folders;
  exception when duplicate_object then null;
  end;
end $$;
