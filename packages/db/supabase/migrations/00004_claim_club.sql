-- 00004 — claim_club() lets a fresh user bootstrap themselves into a new club.
--
-- The PWA's onboarding flow calls this RPC after sign-up. The function:
--   1. Verifies the caller is authenticated.
--   2. Refuses if the caller is already attached to a club (prevents accidental
--      double-claim and any cross-club self-promotion).
--   3. Creates a new clubs row + assigns the caller as its club_admin atomically.
--
-- This pattern keeps RLS rules narrow: user_profiles can update their own
-- non-role fields freely, but role/club_id changes flow only through this
-- security-definer function. No need for a permissive RLS policy that would
-- otherwise let any user self-promote into an existing club.

create or replace function public.claim_club(club_name text, short_name text)
returns clubs
language plpgsql security definer set search_path = public
as $$
declare
  new_club clubs%rowtype;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'must be authenticated to claim a club';
  end if;

  if exists (select 1 from user_profiles where id = uid and club_id is not null) then
    raise exception 'user is already attached to a club; ask a super_admin to migrate';
  end if;

  insert into clubs (name, short_name)
  values (trim(club_name), trim(short_name))
  returning * into new_club;

  -- Make sure a profile row exists (the auth trigger should have created one,
  -- but if for any reason it didn't, this insert covers that case).
  insert into user_profiles (id, club_id, role)
  values (uid, new_club.id, 'club_admin')
  on conflict (id) do update
    set club_id = excluded.club_id,
        role = 'club_admin';

  return new_club;
end;
$$;

grant execute on function public.claim_club(text, text) to authenticated;
