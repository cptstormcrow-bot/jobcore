-- 0116: Add Skills (#0043) lets admins save custom skill names.
-- Drops the six-value check on tech_skills.skill added in 0031; unique (tech_id, skill) stays.
alter table public.tech_skills drop constraint if exists tech_skills_skill_check;
