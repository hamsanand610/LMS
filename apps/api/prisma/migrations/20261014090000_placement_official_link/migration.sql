-- Placement drives: the company's official application link (additive; empty for existing drives).
ALTER TABLE "placement_drives" ADD COLUMN "apply_url" VARCHAR(500) NOT NULL DEFAULT '';
