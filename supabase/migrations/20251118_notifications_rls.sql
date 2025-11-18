-- Migration: Enable RLS and policies for notifications
-- After running this migration, inserts should be performed via a server-side
-- process using the SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to SELECT only their own notifications
CREATE POLICY "select_notifications_owner" ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to UPDATE their own notifications (e.g., mark read = true)
CREATE POLICY "update_notifications_owner" ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NOTE: No INSERT policy is created on purpose. Inserts must be done
-- server-side with the Service Role key (or a privileged Postgres function)
-- so clients cannot create arbitrary notifications for other users.

-- If you later want to allow certain client-side inserts, add a carefully
-- scoped INSERT policy that validates the fields and ensures the recipient
-- is appropriate.
