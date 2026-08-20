-- 遷移 006：收合狀態跨裝置保留
-- 在 Supabase → SQL Editor 貼上這段內容執行（重跑也安全）。

-- 白板上卡片是否收合成只露標題
alter table public."cardInstances" add column if not exists collapsed boolean;

-- 側邊欄資料夾是否收合
alter table public.folders add column if not exists collapsed boolean;
