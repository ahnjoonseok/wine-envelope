drop policy if exists "Users can delete own wines" on public.wines;

create policy "Users can delete own wines"
  on public.wines
  for delete
  to authenticated
  using ((auth.uid())::text = (user_id)::text);
