-- Ensure public.users (and profiles) are synced when auth.users is inserted or updated.
-- The function public.sync_user_from_auth() already exists in the consolidated schema.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_from_auth();

