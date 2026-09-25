-- old lecture-lab leftovers: keep the tables (live feature), clear the old rows
DELETE FROM public.lq_attempts;
DELETE FROM public.lq_questions;
DELETE FROM public.lq_lectures;
DELETE FROM public.lq_subtopics;
DELETE FROM public.lq_subjects;

-- groups no longer reference the removed packages feature
ALTER TABLE public.user_groups DROP COLUMN IF EXISTS package_id;

-- functions that only served the removed features
DROP FUNCTION IF EXISTS public.can_manage_committee(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_committee_members(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_committee_years(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_committee_subject(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_add CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_list CASCADE;
DROP FUNCTION IF EXISTS public.committee_team_remove CASCADE;
DROP FUNCTION IF EXISTS public.log_committee_change CASCADE;
DROP FUNCTION IF EXISTS public.set_committee_qr CASCADE;
DROP FUNCTION IF EXISTS public.head_list_committee_members CASCADE;
DROP FUNCTION IF EXISTS public.head_set_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_committee_members CASCADE;
DROP FUNCTION IF EXISTS public.admin_grant_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.admin_revoke_committee_role CASCADE;
DROP FUNCTION IF EXISTS public.can_manage_events CASCADE;
DROP FUNCTION IF EXISTS public.event_visible CASCADE;
DROP FUNCTION IF EXISTS public.apply_coupon CASCADE;
DROP FUNCTION IF EXISTS public.validate_coupon CASCADE;
DROP FUNCTION IF EXISTS public.university_id_by_slug CASCADE;
DROP FUNCTION IF EXISTS public.is_class_member CASCADE;
DROP FUNCTION IF EXISTS public.ensure_lq_default_bucket CASCADE;
DROP FUNCTION IF EXISTS public.user_owns_lecture_course CASCADE;

-- committee library
DROP TABLE IF EXISTS public.committee_best_sources CASCADE;
DROP TABLE IF EXISTS public.committee_subject_courses CASCADE;
DROP TABLE IF EXISTS public.committee_resources CASCADE;
DROP TABLE IF EXISTS public.committee_categories CASCADE;
DROP TABLE IF EXISTS public.committee_subjects CASCADE;
DROP TABLE IF EXISTS public.committee_modules CASCADE;
DROP TABLE IF EXISTS public.committee_semesters CASCADE;
DROP TABLE IF EXISTS public.committee_years CASCADE;
DROP TABLE IF EXISTS public.committee_members CASCADE;
DROP TABLE IF EXISTS public.committee_activity_log CASCADE;

-- events
DROP TABLE IF EXISTS public.event_contacts CASCADE;
DROP TABLE IF EXISTS public.event_members CASCADE;
DROP TABLE IF EXISTS public.event_sections CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;

-- mentor
DROP TABLE IF EXISTS public.mentor_task_completions CASCADE;
DROP TABLE IF EXISTS public.mentor_tasks CASCADE;
DROP TABLE IF EXISTS public.mentor_journal CASCADE;
DROP TABLE IF EXISTS public.mentor_treasures CASCADE;
DROP TABLE IF EXISTS public.mentor_entries CASCADE;
DROP TABLE IF EXISTS public.mentor_categories CASCADE;

-- shop leftovers
DROP TABLE IF EXISTS public.package_purchases CASCADE;
DROP TABLE IF EXISTS public.package_courses CASCADE;
DROP TABLE IF EXISTS public.packages CASCADE;
DROP TABLE IF EXISTS public.coupon_redemptions CASCADE;
DROP TABLE IF EXISTS public.coupon_courses CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.course_options CASCADE;

-- universities / leads
DROP TABLE IF EXISTS public.university_tiles CASCADE;
DROP TABLE IF EXISTS public.universities_settings CASCADE;
DROP TABLE IF EXISTS public.universities CASCADE;
DROP TABLE IF EXISTS public.institution_leads CASCADE;

-- old lecture pages / quizzes / rebuilds
DROP TABLE IF EXISTS public.lecture_quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.lecture_quiz_options CASCADE;
DROP TABLE IF EXISTS public.lecture_quiz_questions CASCADE;
DROP TABLE IF EXISTS public.lecture_quizzes CASCADE;
DROP TABLE IF EXISTS public.lecture_items CASCADE;
DROP TABLE IF EXISTS public.lecture_subjects CASCADE;
DROP TABLE IF EXISTS public.lecture_rebuild_pages CASCADE;
DROP TABLE IF EXISTS public.lecture_rebuilds CASCADE;

-- old batch / iPad tools
DROP TABLE IF EXISTS public.jarvis_batch_german_ipad_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_german_ipad_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_ipad_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_ipad_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_chunks CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_v2_jobs CASCADE;
DROP TABLE IF EXISTS public.jarvis_batch_jobs CASCADE;
DROP TABLE IF EXISTS public.aquavision_items CASCADE;
DROP TABLE IF EXISTS public.aquavision_pages CASCADE;
DROP TABLE IF EXISTS public.aquavision_jobs CASCADE;
DROP TABLE IF EXISTS public.patch_prox_items CASCADE;
DROP TABLE IF EXISTS public.patch_prox_pages CASCADE;
DROP TABLE IF EXISTS public.patch_prox_jobs CASCADE;
DROP TABLE IF EXISTS public.sonic_chunks CASCADE;
DROP TABLE IF EXISTS public.sonic_jobs CASCADE;
DROP TABLE IF EXISTS public.sonic_pdfs CASCADE;

-- other unused leftovers
DROP TABLE IF EXISTS public.site_blocks CASCADE;
DROP TABLE IF EXISTS public.study_plan_subjects CASCADE;
DROP TABLE IF EXISTS public.study_plan_stages CASCADE;
DROP TABLE IF EXISTS public.study_topics CASCADE;
DROP TABLE IF EXISTS public.study_subjects CASCADE;
DROP TABLE IF EXISTS public.class_decks CASCADE;
DROP TABLE IF EXISTS public.class_members CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.space_moderation_log CASCADE;
DROP TABLE IF EXISTS public.ad_creatives CASCADE;
DROP TABLE IF EXISTS public.question_gen_batches CASCADE;
DROP TABLE IF EXISTS public.guides CASCADE;