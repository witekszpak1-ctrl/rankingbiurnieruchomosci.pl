-- Robot katalogu (rola katalog_app, GitHub Actions) zapisuje pomiary odpowiedzi AI i czyta bibliotekę pytań.
-- Tylko tabele pomiarów: bez dostępu do kont, płatności i programu partnerskiego.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'katalog_app') then
    grant usage on schema geo to katalog_app;
    grant select, insert, update on geo.prompts, geo.measurements, geo.mentions, geo.citations, geo.tracked_prompts to katalog_app;
    grant usage, select on sequence geo.mentions_id_seq, geo.citations_id_seq to katalog_app;
  end if;
end
$$;
