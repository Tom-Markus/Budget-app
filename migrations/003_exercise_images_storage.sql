-- ============================================================================
-- Tom's Cabinet — Migration 003 — Stockage des images d'exercices
-- ============================================================================
-- Crée le bucket Supabase Storage pour les photos d'exercices (sport)
-- et les policies RLS : chaque user ne peut lire/écrire que son propre dossier.
-- ============================================================================

-- Bucket public : les URLs sont accessibles sans token
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;

-- INSERT : authentifié, premier segment du chemin = uid
create policy "exercise_images_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'exercise-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- UPDATE : même contrainte
create policy "exercise_images_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'exercise-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- DELETE : même contrainte
create policy "exercise_images_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'exercise-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- SELECT : bucket public → lecture libre (nécessaire pour les URLs publiques)
create policy "exercise_images_select"
on storage.objects for select
using (bucket_id = 'exercise-images');
