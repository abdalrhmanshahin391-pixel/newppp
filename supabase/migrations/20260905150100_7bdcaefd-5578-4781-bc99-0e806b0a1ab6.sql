ALTER TABLE public.lq_subjects ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.lq_subtopics ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "read example lq_subjects" ON public.lq_subjects;
CREATE POLICY "read example lq_subjects" ON public.lq_subjects
  FOR SELECT TO authenticated USING (is_example = true);

DROP POLICY IF EXISTS "read example lq_subtopics" ON public.lq_subtopics;
CREATE POLICY "read example lq_subtopics" ON public.lq_subtopics
  FOR SELECT TO authenticated USING (is_example = true);

-- Clean up the old per-account sample shelf.
DELETE FROM public.lq_subjects WHERE name LIKE '%(sample)%' AND is_example = false;

-- Shared example shelf, owned by a fixed system id.
DELETE FROM public.lq_subjects WHERE user_id = '00000000-0000-4000-8000-000000000001';

INSERT INTO public.lq_subjects (id, user_id, name, sort_order, is_example) VALUES
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Physiology (example)',1,true),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Anatomy (example)',2,true),
  ('a0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Pharmacology (example)',3,true),
  ('a0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Pathology (example)',4,true),
  ('a0000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Biochemistry (example)',5,true),
  ('a0000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','Microbiology (example)',6,true);

INSERT INTO public.lq_subtopics (id, user_id, subject_id, name, sort_order, is_example) VALUES
  ('b0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Cardiac cycle',1,true),
  ('b0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Respiratory volumes',2,true),
  ('b0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Renal filtration',3,true),
  ('b0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','Upper limb',1,true),
  ('b0000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','Thorax',2,true),
  ('b0000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Antibiotics',1,true),
  ('b0000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','Autonomic drugs',2,true),
  ('b0000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','Inflammation',1,true),
  ('b0000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','Neoplasia',2,true),
  ('b0000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','Glycolysis',1,true),
  ('b0000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','Vitamins',2,true),
  ('b0000000-0000-4000-8000-00000000000c','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','Gram-positive cocci',1,true),
  ('b0000000-0000-4000-8000-00000000000d','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','Viral hepatitis',2,true);

INSERT INTO public.lq_lectures (id, user_id, subtopic_id, title, source_name, difficulty, key_points, question_count, is_example) VALUES
  ('c0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','The cardiac cycle (example lecture)','Example lecture','mixed','["Systole vs diastole","Valve events and heart sounds","Preload and afterload"]'::jsonb,3,true),
  ('c0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000006','Beta-lactam antibiotics (example lecture)','Example lecture','mixed','["Cell wall synthesis","Beta-lactamase resistance","Common side effects"]'::jsonb,3,true);

INSERT INTO public.lq_questions (user_id, lecture_id, stem, options, explanation, point_ref, sort_order) VALUES
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Which valves close at the start of ventricular systole, producing the first heart sound?','[{"letter":"A","body":"Aortic and pulmonary valves","is_correct":false},{"letter":"B","body":"Mitral and tricuspid valves","is_correct":true},{"letter":"C","body":"Aortic valve only","is_correct":false},{"letter":"D","body":"Tricuspid valve only","is_correct":false}]'::jsonb,'S1 is the closure of the atrioventricular valves as ventricular pressure rises above atrial pressure. The semilunar valves close later, at the end of systole, giving S2.','Valve events and heart sounds',1),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','During which phase is coronary blood flow to the left ventricle highest?','[{"letter":"A","body":"Isovolumetric contraction","is_correct":false},{"letter":"B","body":"Rapid ejection","is_correct":false},{"letter":"C","body":"Diastole","is_correct":true},{"letter":"D","body":"Atrial systole","is_correct":false}]'::jsonb,'Intramural vessels are compressed during systole, so left coronary perfusion happens mainly in diastole. Tachycardia shortens diastole and reduces coronary filling time.','Systole vs diastole',2),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Increasing venous return raises stroke volume mainly by increasing which factor?','[{"letter":"A","body":"Preload","is_correct":true},{"letter":"B","body":"Afterload","is_correct":false},{"letter":"C","body":"Heart rate","is_correct":false},{"letter":"D","body":"Contractility","is_correct":false}]'::jsonb,'More venous return stretches the ventricle, so end-diastolic volume (preload) rises and stroke volume follows the Frank-Starling relationship.','Preload and afterload',3),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','What is the mechanism of action of penicillins?','[{"letter":"A","body":"Inhibit the 50S ribosomal subunit","is_correct":false},{"letter":"B","body":"Inhibit cell wall cross-linking by binding transpeptidases","is_correct":true},{"letter":"C","body":"Inhibit DNA gyrase","is_correct":false},{"letter":"D","body":"Disrupt folate synthesis","is_correct":false}]'::jsonb,'Beta-lactams bind penicillin-binding proteins (transpeptidases) and block peptidoglycan cross-linking, so growing bacteria lyse. They are bactericidal and need actively dividing cells.','Cell wall synthesis',1),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','Adding clavulanic acid to amoxicillin helps because it:','[{"letter":"A","body":"Blocks beta-lactamase enzymes","is_correct":true},{"letter":"B","body":"Improves oral absorption","is_correct":false},{"letter":"C","body":"Widens ribosomal binding","is_correct":false},{"letter":"D","body":"Slows renal clearance","is_correct":false}]'::jsonb,'Clavulanic acid is a suicide inhibitor of beta-lactamase, protecting amoxicillin from enzymatic breakdown and restoring activity against resistant organisms.','Beta-lactamase resistance',2),
  ('00000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','Which reaction is the classic serious adverse effect of penicillins?','[{"letter":"A","body":"Tendon rupture","is_correct":false},{"letter":"B","body":"Immediate IgE-mediated anaphylaxis","is_correct":true},{"letter":"C","body":"Grey baby syndrome","is_correct":false},{"letter":"D","body":"Ototoxicity","is_correct":false}]'::jsonb,'Type I hypersensitivity to the beta-lactam ring can cause urticaria, bronchospasm and anaphylaxis within minutes. Always ask about the nature of a reported penicillin allergy.','Common side effects',3);