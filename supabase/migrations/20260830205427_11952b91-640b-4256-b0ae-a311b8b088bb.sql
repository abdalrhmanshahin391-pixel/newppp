CREATE TABLE public.de_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  mode TEXT NOT NULL DEFAULT 'articles',
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6aa9d8',
  position INTEGER NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.de_subtopics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.de_subjects(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.de_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtopic_id UUID NOT NULL REFERENCES public.de_subtopics(id) ON DELETE CASCADE,
  user_id UUID,
  kind TEXT NOT NULL DEFAULT 'noun',
  german TEXT NOT NULL,
  article TEXT,
  plural TEXT,
  english TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.de_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.de_items(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);
CREATE TABLE public.de_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.de_items(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'tap',
  correct BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX de_subtopics_subject_idx ON public.de_subtopics(subject_id);
CREATE INDEX de_items_subtopic_idx ON public.de_items(subtopic_id);
CREATE INDEX de_attempts_user_item_idx ON public.de_attempts(user_id, item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_subtopics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.de_attempts TO authenticated;
GRANT ALL ON public.de_subjects TO service_role;
GRANT ALL ON public.de_subtopics TO service_role;
GRANT ALL ON public.de_items TO service_role;
GRANT ALL ON public.de_flags TO service_role;
GRANT ALL ON public.de_attempts TO service_role;

ALTER TABLE public.de_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.de_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.de_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.de_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.de_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or sample subjects" ON public.de_subjects FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_sample);
CREATE POLICY "write own subjects" ON public.de_subjects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_sample);
CREATE POLICY "update own subjects" ON public.de_subjects FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own subjects" ON public.de_subjects FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "read own or sample subtopics" ON public.de_subtopics FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_sample);
CREATE POLICY "write own subtopics" ON public.de_subtopics FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_sample);
CREATE POLICY "update own subtopics" ON public.de_subtopics FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own subtopics" ON public.de_subtopics FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "read own or sample items" ON public.de_items FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_sample);
CREATE POLICY "write own items" ON public.de_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_sample);
CREATE POLICY "update own items" ON public.de_items FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own items" ON public.de_items FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "manage own flags" ON public.de_flags FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "manage own attempts" ON public.de_attempts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Sample pack: articles
WITH s AS (
  INSERT INTO public.de_subjects (user_id, mode, name, color, position, is_sample)
  VALUES (NULL, 'articles', 'Sample · Everyday nouns', '#6aa9d8', 0, true)
  RETURNING id
), t AS (
  INSERT INTO public.de_subtopics (subject_id, user_id, name, position, is_sample)
  SELECT s.id, NULL, x.name, x.pos, true FROM s, (VALUES ('Home & city', 0), ('People & time', 1)) AS x(name, pos)
  RETURNING id, name
)
INSERT INTO public.de_items (subtopic_id, user_id, kind, german, article, plural, english, position, is_sample)
SELECT t.id, NULL, 'noun', v.g, v.a, v.p, v.e, v.pos, true
FROM t JOIN (VALUES
  ('Home & city','Bank','die','die Banken','bench / bank',0),
  ('Home & city','Haus','das','die Häuser','house',1),
  ('Home & city','Tisch','der','die Tische','table',2),
  ('Home & city','Küche','die','die Küchen','kitchen',3),
  ('Home & city','Fenster','das','die Fenster','window',4),
  ('Home & city','Bahnhof','der','die Bahnhöfe','train station',5),
  ('Home & city','Straße','die','die Straßen','street',6),
  ('Home & city','Büro','das','die Büros','office',7),
  ('Home & city','Schlüssel','der','die Schlüssel','key',8),
  ('Home & city','Wohnung','die','die Wohnungen','apartment',9),
  ('People & time','Mädchen','das','die Mädchen','girl',0),
  ('People & time','Freund','der','die Freunde','friend',1),
  ('People & time','Freiheit','die','die Freiheiten','freedom',2),
  ('People & time','Arbeit','die','die Arbeiten','work',3),
  ('People & time','Kind','das','die Kinder','child',4),
  ('People & time','Morgen','der','die Morgen','morning',5),
  ('People & time','Woche','die','die Wochen','week',6),
  ('People & time','Jahr','das','die Jahre','year',7),
  ('People & time','Lehrer','der','die Lehrer','teacher',8),
  ('People & time','Möglichkeit','die','die Möglichkeiten','possibility',9)
) AS v(sub, g, a, p, e, pos) ON v.sub = t.name;

-- Sample pack: pronunciation
WITH s AS (
  INSERT INTO public.de_subjects (user_id, mode, name, color, position, is_sample)
  VALUES (NULL, 'speaking', 'Sample · First phrases', '#e0774f', 0, true)
  RETURNING id
), t AS (
  INSERT INTO public.de_subtopics (subject_id, user_id, name, position, is_sample)
  SELECT s.id, NULL, x.name, x.pos, true FROM s, (VALUES ('Greetings', 0), ('Café & travel', 1)) AS x(name, pos)
  RETURNING id, name
)
INSERT INTO public.de_items (subtopic_id, user_id, kind, german, english, position, is_sample)
SELECT t.id, NULL, v.k, v.g, v.e, v.pos, true
FROM t JOIN (VALUES
  ('Greetings','word','Guten Morgen','good morning',0),
  ('Greetings','word','Entschuldigung','excuse me',1),
  ('Greetings','word','Tschüss','bye',2),
  ('Greetings','sentence','Wie geht es dir heute?','How are you today?',3),
  ('Greetings','sentence','Ich heiße Rita und ich lerne Deutsch.','My name is Rita and I am learning German.',4),
  ('Greetings','sentence','Können Sie das bitte wiederholen?','Could you please repeat that?',5),
  ('Café & travel','word','Frühstück','breakfast',0),
  ('Café & travel','word','Bahnhof','train station',1),
  ('Café & travel','sentence','Ich hätte gern einen Kaffee, bitte.','I would like a coffee, please.',2),
  ('Café & travel','sentence','Wann fährt der nächste Zug nach München?','When does the next train to Munich leave?',3),
  ('Café & travel','sentence','Die Straßenbahn kommt in fünf Minuten.','The tram arrives in five minutes.',4)
) AS v(sub, k, g, e, pos) ON v.sub = t.name;