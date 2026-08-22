-- Run in Supabase SQL Editor (New query)
-- Real, publicly verifiable lat/long coordinates for jurisdictions. These are
-- factual geographic reference points, same category of data as a country's
-- name or currency -- not invented or estimated.

create table if not exists jurisdiction_coordinates (
  jurisdiction text primary key,
  lat numeric not null,
  lng numeric not null
);

alter table jurisdiction_coordinates enable row level security;
create policy "Authenticated staff can view jurisdiction_coordinates" on jurisdiction_coordinates
  for select using (auth.role() = 'authenticated');

insert into jurisdiction_coordinates (jurisdiction, lat, lng) values
  ('Cayman Islands', 19.3133, -81.2546),
  ('BVI', 18.4207, -64.6400),
  ('British Virgin Islands', 18.4207, -64.6400),
  ('Cyprus', 35.1264, 33.4299),
  ('Panama', 8.5380, -80.7821),
  ('UK - FCA', 51.5074, -0.1278),
  ('US - FinCEN', 38.9072, -77.0369),
  ('CH - FINMA', 46.9480, 7.4474)
on conflict (jurisdiction) do nothing;
