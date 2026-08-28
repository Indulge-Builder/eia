-- Migration 0176: the third model tier — 'heavy' (Step 3, the Python brain).
--
-- The model policy is DB-driven by design (the llm_providers pattern): switching
-- what runs routing/reasoning/heavy is an UPDATE, never a deploy. The Python
-- brain's router assigns each turn a tier:
--   routing   — fast intent classification            (today: claude-haiku-4-5)
--   reasoning — the default specialist brain          (today: claude-sonnet-5)
--   heavy     — deep analytical / long-report turns   (today: claude-opus-5)
-- The registry falls back heavy → reasoning when the row is missing or inactive,
-- so this row can be toggled off safely at any time.

ALTER TABLE public.llm_providers DROP CONSTRAINT llm_providers_job_type_check;
ALTER TABLE public.llm_providers ADD CONSTRAINT llm_providers_job_type_check
  CHECK (job_type = ANY (ARRAY['routing'::text, 'reasoning'::text, 'heavy'::text]));

INSERT INTO public.llm_providers (job_type, provider, model, max_tokens, active)
VALUES ('heavy', 'anthropic', 'claude-opus-5', 8192, true)
ON CONFLICT (job_type) DO NOTHING;
