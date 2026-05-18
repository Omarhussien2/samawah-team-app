-- Challenges and risks V1 patch
-- Use this on an existing Supabase project after the base schema/RLS/seed files
-- have already been applied. It avoids DO $$ blocks so it is safer to paste
-- into the Supabase SQL Editor.

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS form_instance_id UUID,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'challenge' CHECK (kind IN ('challenge','risk','issue')),
  ADD COLUMN IF NOT EXISTS probability_score SMALLINT NOT NULL DEFAULT 3 CHECK (probability_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS impact_score SMALLINT NOT NULL DEFAULT 3 CHECK (impact_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS risk_score SMALLINT GENERATED ALWAYS AS (probability_score * impact_score) STORED,
  ADD COLUMN IF NOT EXISTS risk_level TEXT GENERATED ALWAYS AS (
    CASE
      WHEN probability_score * impact_score >= 20 THEN 'critical'
      WHEN probability_score * impact_score >= 12 THEN 'high'
      WHEN probability_score * impact_score >= 6 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS response_strategy TEXT NOT NULL DEFAULT 'mitigate' CHECK (response_strategy IN ('mitigate','avoid','transfer','accept','monitor')),
  ADD COLUMN IF NOT EXISTS mitigation_plan TEXT,
  ADD COLUMN IF NOT EXISTS contingency_plan TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS identified_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kpi_id UUID;

ALTER TABLE challenges
  DROP CONSTRAINT IF EXISTS challenges_form_instance_id_fkey;

ALTER TABLE challenges
  ADD CONSTRAINT challenges_form_instance_id_fkey
  FOREIGN KEY (form_instance_id) REFERENCES project_form_instances(id) ON DELETE SET NULL;

ALTER TABLE challenges
  DROP CONSTRAINT IF EXISTS challenges_kpi_id_fkey;

ALTER TABLE challenges
  ADD CONSTRAINT challenges_kpi_id_fkey
  FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_risk_level ON challenges(risk_level);
CREATE INDEX IF NOT EXISTS idx_challenges_kpi ON challenges(kpi_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON challenges TO authenticated;

DROP POLICY IF EXISTS "challenges_update" ON challenges;
CREATE POLICY "challenges_update" ON challenges
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
  );

UPDATE kpi_definitions
SET calculation_method = 'semi_auto',
    auto_source = 'challenges',
    updated_at = NOW()
WHERE code = 'OPS_RISK_COVERAGE';
