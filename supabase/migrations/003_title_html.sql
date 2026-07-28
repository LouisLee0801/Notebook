-- #3 標題格式跨裝置同步：cards 加 titleHtml 欄位（標題的格式化 HTML）
-- 在 Supabase SQL Editor 執行。純文字仍存 title；titleHtml 為 null 代表無格式。

alter table public.cards add column if not exists "titleHtml" text;
