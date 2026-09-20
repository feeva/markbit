-- Aggregate-only usage counter for the landing page (markbit.abcbox.kr
-- itself, never the embed widget on third-party sites — see PLAN.md's
-- Decision Log). No per-visitor identifiers, cookies, or IPs are stored —
-- just a count per (day, event) pair.
CREATE TABLE IF NOT EXISTS events (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event)
);
