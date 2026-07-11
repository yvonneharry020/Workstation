-- Candidate identity verification (NIN/liveness) is entirely third-party —
-- no manual staff step. Admin badge review moved from a candidate-initiated
-- request queue to staff-initiated search (matches how Issue Badge already
-- works company-side). The request-queue table was never wired to any
-- candidate-facing button, safe to drop with zero data loss.
DROP TABLE IF EXISTS admin_badge_requests;

-- Audit footprint for staff decisions on work-history/education claims.
-- Proof arrives via live chat, not a formal upload, so file_url stays null
-- for these rows — they're a decision record, not a file record.
ALTER TABLE verification_documents ADD COLUMN reviewed_by UUID REFERENCES profiles(id);
ALTER TABLE verification_documents ADD COLUMN reviewed_at TIMESTAMPTZ;

-- Real bug found tracing the company onboarding upload step: apps/mobile's
-- step-4.tsx uploads CAC cert / SCUML / business-address-proof to the
-- company-docs storage bucket and gets back real URLs, but only ever
-- persists { company_id, documents_status: 'in_review' } — the URLs live
-- in local component state and are discarded on unmount. Files exist in
-- storage; nothing in the database ever recorded which files belong to
-- which company. These columns are what step-4.tsx should have been
-- writing to, and what the Verification Queue's Companies tab needs to
-- actually show something to review.
ALTER TABLE company_verification ADD COLUMN cac_cert_url TEXT;
ALTER TABLE company_verification ADD COLUMN scuml_url TEXT;
ALTER TABLE company_verification ADD COLUMN address_proof_url TEXT;
