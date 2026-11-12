-- Wejścia z kliknięcia w reklamę, rozpoznane po identyfikatorze kliknięcia w adresie (fbclid, gclid, msclkid, ttclid,
-- li_fat_id). Zapisujemy tylko, z której sieci reklamowej było kliknięcie, bez wartości identyfikatora.
alter table page_views add column ad_click text check (ad_click in ('meta', 'google', 'microsoft', 'tiktok', 'linkedin'));
create index page_views_ad_click_idx on page_views (created_at) where ad_click is not null;
