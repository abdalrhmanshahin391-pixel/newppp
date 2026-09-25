
-- 1) Helper behind "Set one up for me" in Lecture Lab
CREATE OR REPLACE FUNCTION public.ensure_lq_default_bucket()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s_id uuid;
  t_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT id INTO s_id FROM public.lq_subjects
   WHERE user_id = uid AND name = 'My lectures' AND coalesce(is_example, false) = false
   LIMIT 1;
  IF s_id IS NULL THEN
    INSERT INTO public.lq_subjects (user_id, name) VALUES (uid, 'My lectures') RETURNING id INTO s_id;
  END IF;

  SELECT id INTO t_id FROM public.lq_subtopics
   WHERE user_id = uid AND subject_id = s_id AND name = 'General'
   LIMIT 1;
  IF t_id IS NULL THEN
    INSERT INTO public.lq_subtopics (user_id, subject_id, name) VALUES (uid, s_id, 'General') RETURNING id INTO t_id;
  END IF;

  RETURN jsonb_build_object('subjectId', s_id, 'subtopicId', t_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_lq_default_bucket() TO authenticated;

-- 2) Sample content, written once with fixed ids
WITH q(n, stem, a, b, c, d, correct, why) AS (
  VALUES
  (1,'Which valve closes at the start of ventricular systole?','Mitral valve','Aortic valve','Pulmonary valve','Tricuspid valve only','A','Rising ventricular pressure shuts the mitral valve first, producing the S1 sound. The aortic valve opens, not closes, at this moment.'),
  (2,'The first heart sound (S1) is produced by closure of which valves?','Aortic and pulmonary','Mitral and tricuspid','Mitral and aortic','Tricuspid and pulmonary','B','S1 marks closure of the atrioventricular valves. The semilunar valves (aortic and pulmonary) close later, giving S2.'),
  (3,'During isovolumetric contraction, ventricular volume is:','Rising','Falling','Unchanged','Equal to stroke volume','C','All four valves are shut, so no blood enters or leaves while pressure climbs steeply.'),
  (4,'The P wave of the ECG represents:','Atrial depolarisation','Atrial repolarisation','Ventricular depolarisation','Ventricular repolarisation','A','The P wave is atrial depolarisation; atrial repolarisation is hidden inside the QRS complex.'),
  (5,'A normal PR interval lasts about:','0.04-0.08 s','0.12-0.20 s','0.25-0.35 s','0.40-0.50 s','B','0.12-0.20 s is normal; longer than 0.20 s suggests first-degree AV block.'),
  (6,'The pacemaker of the healthy heart is the:','AV node','Bundle of His','Sinoatrial node','Purkinje fibres','C','The SA node fires fastest (60-100/min), so it sets the rhythm; the others are slower back-up pacemakers.'),
  (7,'Stroke volume equals:','End-diastolic volume minus end-systolic volume','End-systolic volume minus end-diastolic volume','Cardiac output times heart rate','Ejection fraction times heart rate','A','What is ejected is what was there at the end of filling minus what is left after the beat.'),
  (8,'Cardiac output is calculated as:','Heart rate divided by stroke volume','Stroke volume divided by heart rate','Heart rate times stroke volume','Stroke volume times ejection fraction','C','Output per minute = beats per minute x volume ejected per beat.'),
  (9,'The dicrotic notch on the aortic pressure trace is caused by:','Mitral valve opening','Aortic valve closure','Atrial contraction','Opening of the pulmonary valve','B','A brief backflow against the closing aortic valve produces the notch early in diastole.'),
  (10,'Most ventricular filling occurs:','During atrial contraction','Passively in early diastole','During isovolumetric relaxation','During the ejection phase','B','About 70-80% is passive; atrial contraction adds the final top-up.'),
  (11,'Preload is best described as:','Resistance the ventricle pumps against','Ventricular wall stretch at end-diastole','Force of contraction independent of stretch','Pressure in the aorta during systole','B','Preload is end-diastolic stretch; the resistance term is afterload.'),
  (12,'The Frank-Starling law states that:','Contraction force falls as fibre length rises','Contraction force rises with end-diastolic fibre length','Heart rate rises with venous return only','Afterload determines stroke volume alone','B','Greater filling stretches the fibres and yields a stronger contraction, matching output to venous return.'),
  (13,'Sympathetic stimulation of the heart mainly acts on which receptors?','Beta-1 adrenergic','Beta-2 adrenergic','Muscarinic M2','Alpha-1 adrenergic','A','Cardiac beta-1 receptors raise rate and contractility; M2 receptors carry the vagal slowing effect.'),
  (14,'A prolonged QT interval increases the risk of:','Atrial fibrillation','Torsades de pointes','First-degree AV block','Sinus bradycardia','B','Delayed repolarisation predisposes to this polymorphic ventricular tachycardia.'),
  (15,'The plateau phase of the ventricular action potential is maintained by:','Sodium influx','Calcium influx','Potassium influx','Chloride efflux','B','Slow L-type calcium entry balances potassium exit, holding the plateau and lengthening the refractory period.')
),
c AS (
  INSERT INTO public.courses (id, title, year, price, category, exam_type, published, subjects_count,
                              questions_count_mid, questions_count_final, kind, university_id, show_on_home)
  VALUES ('11111111-1111-4111-8111-111111111111', 'RitaJet sample bank — Cardiac physiology', 1, 0,
          'major', 'MCQ', true, 1, 15, 0, 'questions', '11111111-1111-4111-8111-1111111111aa', true)
  RETURNING id
),
g AS (
  INSERT INTO public.subject_groups (id, course_id, name, sort_order)
  SELECT '22222222-2222-4222-8222-222222222222', c.id, 'Cardiovascular system', 0 FROM c
  RETURNING id
),
s AS (
  INSERT INTO public.subjects (id, group_id, name, sort_order, access_level)
  SELECT '33333333-3333-4333-8333-333333333333', g.id, 'Cardiac cycle & ECG', 0, 'free_public'::subject_access FROM g
  RETURNING id
),
ins_q AS (
  INSERT INTO public.questions (id, subject_id, stem, explanation, sort_order)
  SELECT ('44444444-4444-4444-8444-' || lpad(q.n::text, 12, '0'))::uuid, s.id, q.stem, q.why, q.n
  FROM q CROSS JOIN s
  RETURNING id, sort_order
)
INSERT INTO public.question_options (question_id, label, text, is_correct, sort_order)
SELECT ins_q.id, o.label, o.text, o.label = q.correct, o.ord
FROM ins_q
JOIN q ON q.n = ins_q.sort_order
CROSS JOIN LATERAL (VALUES ('A', q.a, 0), ('B', q.b, 1), ('C', q.c, 2), ('D', q.d, 3)) AS o(label, text, ord);

-- 3) Lecture Lab shared example (same material)
WITH q(n, stem, a, b, c, d, correct, why) AS (
  VALUES
  (1,'Which valve closes at the start of ventricular systole?','Mitral valve','Aortic valve','Pulmonary valve','Tricuspid valve only','A','Rising ventricular pressure shuts the mitral valve first, producing S1. The aortic valve opens here instead.'),
  (2,'The first heart sound (S1) is produced by closure of which valves?','Aortic and pulmonary','Mitral and tricuspid','Mitral and aortic','Tricuspid and pulmonary','B','S1 is atrioventricular valve closure; the semilunar valves make S2.'),
  (3,'During isovolumetric contraction, ventricular volume is:','Rising','Falling','Unchanged','Equal to stroke volume','C','All valves are shut, so pressure rises with no volume change.'),
  (4,'The P wave of the ECG represents:','Atrial depolarisation','Atrial repolarisation','Ventricular depolarisation','Ventricular repolarisation','A','Atrial repolarisation hides inside the QRS complex.'),
  (5,'A normal PR interval lasts about:','0.04-0.08 s','0.12-0.20 s','0.25-0.35 s','0.40-0.50 s','B','Above 0.20 s means first-degree AV block.'),
  (6,'The pacemaker of the healthy heart is the:','AV node','Bundle of His','Sinoatrial node','Purkinje fibres','C','The SA node has the fastest intrinsic rate, so it leads.'),
  (7,'Stroke volume equals:','End-diastolic volume minus end-systolic volume','End-systolic volume minus end-diastolic volume','Cardiac output times heart rate','Ejection fraction times heart rate','A','Ejected volume = filled volume minus what remains.'),
  (8,'Cardiac output is calculated as:','Heart rate divided by stroke volume','Stroke volume divided by heart rate','Heart rate times stroke volume','Stroke volume times ejection fraction','C','Beats per minute multiplied by volume per beat.'),
  (9,'The dicrotic notch is caused by:','Mitral valve opening','Aortic valve closure','Atrial contraction','Pulmonary valve opening','B','A brief backflow against the closing aortic valve marks the notch.'),
  (10,'Most ventricular filling occurs:','During atrial contraction','Passively in early diastole','During isovolumetric relaxation','During ejection','B','Passive filling supplies roughly three quarters of the volume.'),
  (11,'Preload is best described as:','Resistance pumped against','Ventricular stretch at end-diastole','Contractility independent of stretch','Aortic systolic pressure','B','Resistance pumped against is afterload, not preload.'),
  (12,'The Frank-Starling law states that:','Force falls as fibre length rises','Force rises with end-diastolic fibre length','Rate rises with venous return only','Afterload alone sets stroke volume','B','More stretch gives a stronger beat, matching output to venous return.'),
  (13,'Sympathetic drive to the heart acts mainly on:','Beta-1 receptors','Beta-2 receptors','Muscarinic M2 receptors','Alpha-1 receptors','A','Beta-1 raises rate and contractility; M2 carries vagal slowing.'),
  (14,'A prolonged QT interval risks:','Atrial fibrillation','Torsades de pointes','First-degree AV block','Sinus bradycardia','B','Delayed repolarisation triggers this polymorphic VT.'),
  (15,'The action potential plateau is held by:','Sodium influx','Calcium influx','Potassium influx','Chloride efflux','B','Slow calcium entry offsets potassium exit during the plateau.')
),
sub AS (
  INSERT INTO public.lq_subjects (id, user_id, name, sort_order, is_example)
  VALUES ('55555555-5555-4555-8555-555555555555', '79ce765f-5323-48c1-8fe3-51eb56b32755', 'RitaJet examples', 0, true)
  RETURNING id
),
top AS (
  INSERT INTO public.lq_subtopics (id, user_id, subject_id, name, sort_order, is_example)
  SELECT '66666666-6666-4666-8666-666666666666', '79ce765f-5323-48c1-8fe3-51eb56b32755', sub.id, 'Cardiac physiology', 0, true FROM sub
  RETURNING id
),
lec AS (
  INSERT INTO public.lq_lectures (id, user_id, subtopic_id, title, source_name, difficulty, key_points, question_count, is_example)
  SELECT '77777777-7777-4777-8777-777777777777', '79ce765f-5323-48c1-8fe3-51eb56b32755', top.id,
         'Sample lecture — the cardiac cycle', 'RitaJet sample', 'mixed',
         '["The cardiac cycle alternates systole and diastole about once a second at rest.","S1 is AV valve closure; S2 is semilunar valve closure.","Isovolumetric phases happen with all four valves shut.","The SA node sets the rhythm; the AV node delays conduction.","P wave = atrial depolarisation, QRS = ventricular depolarisation, T wave = ventricular repolarisation.","Stroke volume = end-diastolic minus end-systolic volume.","Cardiac output = heart rate x stroke volume.","Frank-Starling: more filling gives a stronger beat.","Beta-1 stimulation raises rate and force; vagal M2 slows the heart.","The calcium plateau keeps the ventricle refractory during ejection."]'::jsonb,
         15, true
  FROM top
  RETURNING id
)
INSERT INTO public.lq_questions (user_id, lecture_id, stem, options, explanation, point_ref, sort_order)
SELECT '79ce765f-5323-48c1-8fe3-51eb56b32755', lec.id, q.stem,
       jsonb_build_array(
         jsonb_build_object('letter','A','body',q.a,'is_correct', q.correct = 'A'),
         jsonb_build_object('letter','B','body',q.b,'is_correct', q.correct = 'B'),
         jsonb_build_object('letter','C','body',q.c,'is_correct', q.correct = 'C'),
         jsonb_build_object('letter','D','body',q.d,'is_correct', q.correct = 'D')
       ),
       q.why, 'Cardiac cycle', q.n
FROM q CROSS JOIN lec;
