alter table public.wines
  add column if not exists appearance_color text not null default '#caa46b';
