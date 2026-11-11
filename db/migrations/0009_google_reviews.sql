-- Ocena i opinie z Google (Places API). Odświeżane regularnie, pokazywane z oznaczeniem źródła.
create table google_places (
  brand_id     uuid primary key references brands(id) on delete cascade,
  place_id     text,
  rating       numeric(2, 1) check (rating is null or (rating >= 1 and rating <= 5)),
  rating_count integer check (rating_count is null or rating_count >= 0),
  maps_url     text,
  reviews      jsonb not null default '[]'::jsonb,
  status       text not null default 'ok' check (status in ('ok', 'not_found', 'error')),
  fetched_at   timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant select, insert, update, delete on google_places to katalog_app;
  end if;
end
$$;
