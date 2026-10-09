-- Screenshots through the controller (PRD 1318, s3; docs: .omni-loop/delivery/inbox/1318-layered-data-access/spec.md,
-- "Screenshots"): the ask page no longer uploads straight into the `ask-attachments` bucket; it sends
-- each screenshot to POST /api/ask/rounds/:id/attachments/:name, one per request, and Vercel caps a
-- request at 4.5 MB. The controller takes at most 4 MB (4194304 bytes), and the bucket's own limit
-- drops from 5 MB to match, so neither side takes a file the other refuses.
--
-- A screenshot between 4 and 5 MB, accepted before, is refused after. Files already stored are left
-- as they are.
--
-- Rollback: a follow-up migration setting file_size_limit back to 5242880.

update storage.buckets
   set file_size_limit = 4194304
 where id = 'ask-attachments';
