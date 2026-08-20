-- 遷移 005：卡片上的標籤可自行拖曳排序（#4）
-- 在 Supabase → SQL Editor 貼上這段內容執行（重跑也安全）。

alter table public."cardTags" add column if not exists "sortOrder" double precision;
