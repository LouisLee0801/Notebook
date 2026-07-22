-- 遷移 001：標籤顏色（#2）
-- 已經建過資料表的專案，在 Supabase → SQL Editor 執行這一行即可（重跑也安全）。
alter table public.tags add column if not exists color text;
