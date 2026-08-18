-- 遷移 004：白板資料夾（#1）
-- 既有專案在 Supabase → SQL Editor 執行這整段即可（重跑也安全）。

-- 資料夾分成卡片用與白板用；舊資料沒有 kind，讀取時一律視為卡片資料夾
alter table public.folders add column if not exists kind text;

-- 白板的所屬資料夾
alter table public.whiteboards add column if not exists "folderId" text;
