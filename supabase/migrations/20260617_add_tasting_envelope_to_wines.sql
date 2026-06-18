alter table public.wines
  add column if not exists envelope jsonb not null default jsonb_build_object(
    'aroma', jsonb_build_object('y', 0.62),
    'palate', jsonb_build_object('y', 0.56),
    'finish', jsonb_build_object('x', 0.5, 'y', 0.48)
  );

alter table public.wines
  add column if not exists note_tags jsonb not null default jsonb_build_object(
    'aroma', jsonb_build_array(),
    'palate', jsonb_build_array(),
    'finish', jsonb_build_array()
  );

alter table public.wines
  add column if not exists catalog_source text;

alter table public.wines
  add column if not exists catalog_external_id text;

create index if not exists wines_catalog_ref_idx
  on public.wines (catalog_source, catalog_external_id);
