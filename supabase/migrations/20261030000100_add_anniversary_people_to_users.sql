ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS anniversary1_relationship text,
  ADD COLUMN IF NOT EXISTS anniversary1_person_name text,
  ADD COLUMN IF NOT EXISTS anniversary1_person_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anniversary2_relationship text,
  ADD COLUMN IF NOT EXISTS anniversary2_person_name text,
  ADD COLUMN IF NOT EXISTS anniversary2_person_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anniversary3_relationship text,
  ADD COLUMN IF NOT EXISTS anniversary3_person_name text,
  ADD COLUMN IF NOT EXISTS anniversary3_person_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;