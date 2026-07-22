-- Notebook 雲端同步資料表（Plan A+，docs/development-plans.md）
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上整份執行一次。
--
-- 設計說明：
-- * 欄位名刻意用引號保留 camelCase，與前端 Dexie схema 一一對應，同步層不需欄位轉換。
-- * 每張表都有 user_id（預設 auth.uid()）+ Row Level Security：只有本人能讀寫自己的資料。
-- * client_id 用來過濾 Realtime 的自我回音（自己這台送出的變更不用再套用一次）。
-- * 時間戳一律 bigint（epoch ms），與前端 Date.now() 對齊，衝突採 last-write-wins。

-- ---------- 資料表 ----------

create table if not exists public.cards (
  id text primary key,
  title text not null default '',
  content jsonb,
  "createdAt" bigint not null,
  "updatedAt" bigint not null,
  "archivedAt" bigint,
  "deletedAt" bigint,
  user_id uuid not null default auth.uid(),
  client_id text
);

create table if not exists public.whiteboards (
  id text primary key,
  name text not null default '',
  "parentId" text,
  "createdAt" bigint not null,
  "updatedAt" bigint not null,
  user_id uuid not null default auth.uid(),
  client_id text
);

create table if not exists public."cardInstances" (
  id text primary key,
  "whiteboardId" text not null,
  "cardId" text not null,
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null default 0,
  color text,
  "sectionId" text,
  user_id uuid not null default auth.uid(),
  client_id text
);

create table if not exists public."boardEdges" (
  id text primary key,
  "whiteboardId" text not null,
  "fromInstanceId" text not null,
  "toInstanceId" text not null,
  label text,
  arrow text not null default 'forward',
  user_id uuid not null default auth.uid(),
  client_id text
);

create table if not exists public.sections (
  id text primary key,
  "whiteboardId" text not null,
  name text not null default '',
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null,
  collapsed boolean not null default false,
  user_id uuid not null default auth.uid(),
  client_id text
);

create table if not exists public."boardNotes" (
  id text primary key,
  "whiteboardId" text not null,
  text text not null default '',
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null,
  user_id uuid not null default auth.uid(),
  client_id text
);

create table if not exists public.tags (
  id text primary key,
  name text not null,
  properties jsonb not null default '[]',
  color text,
  user_id uuid not null default auth.uid(),
  client_id text
);
-- 既有專案補欄位（重跑整份也安全）
alter table public.tags add column if not exists color text;

create table if not exists public."cardTags" (
  "cardId" text not null,
  "tagId" text not null,
  "values" jsonb not null default '{}',
  user_id uuid not null default auth.uid(),
  client_id text,
  primary key (user_id, "cardId", "tagId")
);

create table if not exists public."cardLinks" (
  "fromCardId" text not null,
  "fromBlockId" text not null default '',
  "toCardId" text not null,
  user_id uuid not null default auth.uid(),
  client_id text,
  primary key (user_id, "fromCardId", "toCardId")
);

create table if not exists public.journal (
  date text not null,
  "cardId" text not null,
  user_id uuid not null default auth.uid(),
  client_id text,
  primary key (user_id, date)
);

-- ---------- Row Level Security ----------

do $$
declare t text;
begin
  foreach t in array array[
    'cards','whiteboards','cardInstances','boardEdges','sections',
    'boardNotes','tags','cardTags','cardLinks','journal'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
    -- Realtime 需要完整舊列（含 client_id）才能過濾刪除事件的回音
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- ---------- Realtime ----------

do $$
declare t text;
begin
  foreach t in array array[
    'cards','whiteboards','cardInstances','boardEdges','sections',
    'boardNotes','tags','cardTags','cardLinks','journal'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
