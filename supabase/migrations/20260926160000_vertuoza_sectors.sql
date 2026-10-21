-- The first workspace's sectors. This migration once gave the maintainer's own workspace its
-- sectors and its plan repository; since PRD 2305 a fresh install seeds no workspace, so it changes
-- nothing. Production applied it long ago and records a migration by its version, never its
-- content, so this edit changes fresh installs only. Its version stays, so the order of every later
-- migration holds.
--
-- A workspace's sectors are its owner's to set; the demo world's come from supabase/seed.sql.
select 1;
