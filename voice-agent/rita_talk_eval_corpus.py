"""Jordanian learners' questions for the free-conversation evaluation (rita_talk_eval.py).

Written by hand the way Jordanian students actually talk to a tutor: Jordanian Arabic with English
or German words mixed in, the slips a speech recogniser makes (an English word heard and written in
Arabic letters), real goals (IELTS, Goethe A1, working as a doctor in Germany, a job interview) and
the turns that go wrong in a live call ("ما فهمت", a question that is not about the language, giving
up). Public dialect corpora (MADAR and others) hold general sentences, not learners' questions, and
their licences are for research, so none of their text is copied here.

Two parts:
- DEV: the conversations prompts are improved against;
- HOLDOUT: never looked at while changing a prompt; the final score is read here, so a change that
  only fits the DEV lines does not count as an improvement.

Each turn's checks are plain (rita_talk_probe.check_turn); `want` says what a good reply does, for
the person grading the replies by reading them.
"""

from __future__ import annotations

from rita_talk_probe import DE, EN, Talk, Turn

T = Turn

DEV: tuple[Talk, ...] = (
    Talk(
        "en-medical-student",
        "ar",
        EN,
        (
            T("هاي، أنا طالب طب بالجامعة الأردنية وبدي أقوّي إنجليزيتي", sheet="no", lead=True,
              want="A short warm welcome and one easy question with a phrase to answer with."),
            T("I study medicine in fifth year", sheet="no", lead=True,
              fix=("my fifth year", "fifth-year", "the fifth year", "5th year"),
              want="Gently gives 'I'm in my fifth year of medicine', then keeps the chat going."),
            T("شو يعني residency؟", sheet="no", must=("إقامة", "اقامه", "تخصص", "تدريب", "اختصاص"),
              want="Residency = فترة الإقامة / التخصص بالمستشفى بعد التخرج, in one sentence."),
            T("كيف بقول بدي أتخصص جراحة؟", sheet="no", must=("specialize", "specialise", "surgery"),
              want="'I want to specialize in surgery.' said once, nothing more."),
            T("تمام شكراً", sheet="no", want="A one-line reply; no lecture, no sheet."),
        ),
    ),
    Talk(
        "en-corrections",
        "ar",
        EN,
        (
            T("صحّحلي هاي الجملة: I am agree with you", sheet="no", fix=("I agree with you",),
              want="'I agree with you' (agree is a verb, no am), one short reason."),
            T("Yesterday I go to the mall with my friends", sheet="no", lead=True, fix=("went",),
              want="'Yesterday I went to the mall…', then a question about the mall."),
            T("He don't like coffee", sheet="no", fix=("doesn't", "does not"),
              want="'He doesn't like coffee' with he → doesn't."),
            T("I'm boring in the lecture", sheet="no", fix=("bored",),
              want="'I'm bored' (boring = the lecture is boring). Can be a little funny."),
            T("I've been studying medicine for five years", sheet="no", lead=True, right=True,
              want="Says the sentence is right; no correction; one question."),
        ),
    ),
    Talk(
        "en-meanings-slang",
        "ar",
        EN,
        (
            T("شو يعني awkward؟", sheet="no", must=("محرج", "إحراج", "احراج", "مكسوف", "غريب"),
              want="Awkward = محرج / موقف محرج, with one tiny example."),
            T("وشو يعني no cap؟", sheet="no", must=("بجد", "والله", "كذب", "صدق", "بصراحة", "جد"),
              want="No cap = بدون كذب / والله بجد, slang among young people."),
            T("كيف بقول \"يا زلمة\" بالإنجليزي؟", sheet="no", must=("dude", "man", "bro"),
              want="'Dude' / 'man' / 'bro', casual only."),
            T("ليش بقولوا I'm down يعني موافق؟", sheet="no", must=("موافق", "جاهز", "معك", "ماشي"),
              want="Yes: I'm down = I'm in / موافق، معك, casual. Not 'sad'."),
        ),
    ),
    Talk(
        "en-heard-in-arabic-letters",
        "ar",
        EN,
        (
            T("كيف بلفظ ثرو يعني through", sheet="no", must=("through",),
              want="Says how 'through' sounds (like 'threw', th soft), no long phonetics."),
            T("شو الفرق بين ميك و دو", sheet="any", must=("make",),
              want="Understands ميك/دو = make/do: make = create, do = tasks/activities; examples."),
            T("اعطيني أمثلة على ميك", sheet="any", must=("make",),
              want="Two or three 'make' examples (make a cake, make a mistake, make a decision)."),
            T("ما فهمت ولا اشي", sheet="no", simplify=True,
              want="One simpler sentence and one example, in Arabic."),
        ),
    ),
    Talk(
        "en-ielts",
        "ar",
        EN,
        (
            T("عندي امتحان آيلتس كمان شهر وخايف من السبيكنج", sheet="no", lead=True,
              want="Reassures in one line and offers to practise now with a first question."),
            T("شو بيسألوا بأول جزء؟", sheet="any",
              want="Part 1: short questions about you (home, study/work, hobbies), about 4–5 minutes."),
            T("Can you ask me a question like the exam?", sheet="no", lead=True,
              want="Asks one Part-1 style question (e.g. 'Do you work or are you a student?')."),
            T("I am living in Amman since 2010", sheet="no",
              fix=("I have lived", "I've lived", "I have been living", "I've been living"),
              want="'I've lived in Amman since 2010' (since → present perfect)."),
        ),
    ),
    Talk(
        "en-email",
        "ar",
        EN,
        (
            T("بدي أكتب ايميل لدكتوري إني رح أغيب بكرة، ساعدني", sheet="yes",
              want="A short polite email on the sheet; spoken part one sentence."),
            T("اعمله أرسمي شوي", sheet="any", want="A more formal version (Dear Dr …, I am writing to inform you…)."),
            T("شو يعني Kind regards؟", sheet="no", must=("مع", "تحيات", "احترام", "تحية"),
              want="Kind regards = مع التحية / مع خالص التحيات, the email sign-off."),
        ),
    ),
    Talk(
        "en-giving-up",
        "ar",
        EN,
        (
            T("الإنجليزي صعب كثير وبدي أستسلم", sheet="no", lead=True,
              want="Brief real empathy, one small easy step, not a speech."),
            T("بحس حالي بنسى الكلمات بسرعة", sheet="no",
              want="One practical tip (use the word in a sentence today / review tomorrow)."),
            T("طيب علمني ٣ كلمات بس", sheet="any", want="Exactly three useful words with meanings."),
        ),
    ),
    Talk(
        "en-off-topic",
        "ar",
        EN,
        (
            T("مين فاز بمباراة النشامى امبارح؟", sheet="no",
              forbid=("2-1", "1-0", "2-0", "3-1", "1-1", "0-0", "٢-١", "١-٠"),
              want="Does not invent a score; says it can't follow live results and turns it into English (how to talk about a match)."),
            T("احكيلي نكتة بالإنجليزي", sheet="no", want="A short clean joke in simple English with its meaning."),
            T("شو رأيك بالمنسف؟", sheet="no", lead=True, want="Friendly, short, then a question with a phrase (e.g. 'Mansaf is my favourite dish')."),
        ),
    ),
    Talk(
        "en-restaurant-roleplay",
        "ar",
        EN,
        (
            T("خلينا نعمل تمثيل إني بطلب أكل بمطعم", sheet="no", lead=True,
              want="Plays the waiter at once: 'Hi, what can I get you?' plus a phrase to answer with."),
            T("I want a burger and a cola please", sheet="no",
              want="Stays in the role; may mention 'I'd like' is politer, without calling it wrong."),
            T("How much it cost?", sheet="no", fix=("How much does it cost", "How much is it", "How much is that", "How much does that cost"),
              want="'How much does it cost?' / 'How much is it?', then answers as the waiter."),
            T("Thanks, keep the change", sheet="no", right=True, want="Stays in role, says it is right, ends nicely."),
        ),
    ),
    Talk(
        "en-english-speaker",
        "en",
        EN,
        (
            T("Hi, can we practise small talk?", sheet="no", lead=True, want="Starts small talk at once with one question."),
            T("I am from Jordan, I live in Irbid", sheet="no", lead=True, right=True, want="No correction; a question about Irbid."),
            T("What's the difference between 'say' and 'tell'?", sheet="any", must=("tell",),
              want="tell + person (tell me), say + words (say hello)."),
            T("I told to him the truth", sheet="no", fix=("I told him",), want="'I told him the truth' (no 'to' after tell)."),
        ),
    ),
    Talk(
        "de-doctor-in-germany",
        "ar",
        DE,
        (
            T("أنا طالب طب وبدي أشتغل بألمانيا، بدي أتعلم ألماني للمستشفى", sheet="no", lead=True,
              want="Short, encouraging; starts with one hospital phrase to say."),
            T("كيف بسأل المريض وين بوجعك؟", sheet="no", must=("Wo tut", "Wo haben Sie Schmerzen", "weh"),
              want="'Wo tut es Ihnen weh?' / 'Wo haben Sie Schmerzen?' (Sie with patients)."),
            T("شو يعني Kopfschmerzen؟", sheet="no", must=("صداع", "وجع راس", "وجع الراس", "وجع رأس", "ألم الرأس"),
              want="Kopfschmerzen = صداع / وجع راس."),
            T("طيب وكيف بقول عنده حرارة؟", sheet="no", must=("Fieber",), want="'Er hat Fieber.'"),
            T("شو الفرق بين du و Sie مع المريض؟", sheet="any", must=("Sie",),
              want="With patients always Sie (formal); du for friends, family, children."),
        ),
    ),
    Talk(
        "de-corrections",
        "ar",
        DE,
        (
            T("Ich bin 25 Jahre", sheet="no", fix=("Jahre alt",), want="'Ich bin 25 Jahre alt.'"),
            T("Ich habe nach Hause gegangen", sheet="no", fix=("bin nach Hause gegangen", "Ich bin"),
              want="gehen takes sein: 'Ich bin nach Hause gegangen.'"),
            T("Ich möchte ein Kaffee", sheet="no", fix=("einen Kaffee",), want="'Ich möchte einen Kaffee' (der Kaffee → einen)."),
            T("Gestern ich habe Fußball gespielt", sheet="no", fix=("Gestern habe ich",),
              want="Verb second: 'Gestern habe ich Fußball gespielt.'"),
            T("Ich komme aus Jordanien und ich bin Student", sheet="no", lead=True, right=True,
              want="Right; no correction; a question."),
        ),
    ),
    Talk(
        "de-articles",
        "ar",
        DE,
        (
            T("Mädchen مذكر ولا مؤنث؟", sheet="no", must=("das Mädchen", "das"),
              want="Neither: das Mädchen (neuter) because of -chen."),
            T("ليش؟ مش هي بنت؟", sheet="any", must=("chen",),
              want="Grammar gender ≠ real gender; every -chen word is das."),
            T("اعطيني قاعدة سهلة أعرف فيها der die das", sheet="yes",
              want="A few endings on the sheet (-ung/-heit/-keit → die, -chen → das, …), spoken one line."),
            T("ما فهمت", sheet="no", simplify=True, want="One simpler sentence with one example."),
        ),
    ),
    Talk(
        "de-numbers",
        "ar",
        DE,
        (
            T("كيف بحكي ٢٥ بالألماني؟", sheet="no", must=("fünfundzwanzig",), want="fünfundzwanzig (five-and-twenty)."),
            T("و٩٧؟", sheet="no", must=("siebenundneunzig",), want="siebenundneunzig."),
            T("ليش بقلبوا الرقم؟", sheet="any", want="Units before tens, like old English 'four-and-twenty'; just how German works."),
        ),
    ),
    Talk(
        "de-cafe",
        "ar",
        DE,
        (
            T("بدي أتدرب كيف أطلب قهوة بمقهى بألمانيا", sheet="no", lead=True,
              want="Plays the barista: 'Was darf es sein?' plus a phrase to answer with."),
            T("Einen Kaffee, bitte", sheet="no", lead=True, right=True, want="Right; continues the scene."),
            T("كيف بقول بدي أدفع بالبطاقة؟", sheet="no", must=("Karte",), want="'Ich möchte mit Karte zahlen.'"),
            T("شو يعني Zum Mitnehmen؟", sheet="no", must=("تيك", "تاخذ", "آخذ", "اخذ", "سفري", "معك", "معي", "برا"),
              want="To take away / تاخذه معك (opposite: hier trinken)."),
        ),
    ),
    Talk(
        "de-heard-in-arabic-letters",
        "ar",
        DE,
        (
            T("شو يعني جوتن مورجن", sheet="no", must=("صباح",), want="Guten Morgen = صباح الخير."),
            T("كيف بلفظ آيش هورنشن", sheet="no", must=("Eichhörnchen", "Eichhoernchen"),
              want="Understands Eichhörnchen (squirrel), splits it Eich-hörn-chen."),
            T("شو يعني بيته", sheet="no", must=("bitte",), want="Understands 'bitte' = من فضلك / تفضل."),
            T("تمام دانكي", sheet="no", want="Short; may note 'Danke' / 'Bitte schön'."),
        ),
    ),
    Talk(
        "de-switching-language",
        "ar",
        DE,
        (
            T("احكي معي ألماني بس من هسا", sheet="no", free_language=True,
              want="Switches to simple German at once, one short question."),
            T("Wie geht es dir?", sheet="no", lead=True, free_language=True, want="Answers in simple German and asks back."),
            T("Mir geht es gut, danke", sheet="no", right=True, free_language=True, want="Right; carries on in German."),
            T("ارجعي احكي عربي، تعبت", sheet="no", want="Back to Arabic at once, kindly."),
        ),
    ),
    Talk(
        "de-goethe-a1",
        "ar",
        DE,
        (
            T("عندي امتحان Goethe A1 كمان شهرين، من وين أبلش؟", sheet="any",
              want="One clear first step (introduce yourself: Name, Alter, Land, Wohnort, Sprachen, Beruf, Hobby)."),
            T("شو بيطلبوا بالمحادثة؟", sheet="any",
              want="Speaking: introduce yourself, ask/answer questions with word cards, make/answer requests."),
            T("Ich heiße Ahmad. Ich bin 22 Jahre alt. Ich wohne in Zarqa.", sheet="no", lead=True, right=True,
              want="All right; no correction; next question."),
            T("كيف بسأل حدا شو هوايتك؟", sheet="no", must=("Hobby", "Hobbys", "Freizeit"),
              want="'Was ist dein Hobby?' / 'Was machst du in deiner Freizeit?'"),
        ),
    ),
    Talk(
        "de-accusative",
        "ar",
        DE,
        (
            T("اشرحلي الأكوزاتيف ببساطة", sheet="yes", want="Object case; der → den, others stay; short table."),
            T("طيب بعد أي حروف جر بيجي؟", sheet="any", must=("für",), want="durch, für, gegen, ohne, um."),
            T("خلص كفاية قواعد", sheet="no", want="Stops; one line; maybe a light chat question."),
        ),
    ),
    Talk(
        "de-hospital-words",
        "ar",
        DE,
        (
            T("اعطيني ٥ كلمات عن المستشفى", sheet="yes", must=("Krankenhaus", "Arzt", "Ärztin"),
              want="Five words with articles on the sheet."),
            T("كيف بلفظ Krankenschwester؟", sheet="no", want="Splits it Kran-ken-schwes-ter; short."),
            T("شو جمع Arzt؟", sheet="no", must=("Ärzte",), want="die Ärzte."),
        ),
    ),
)

HOLDOUT: tuple[Talk, ...] = (
    Talk(
        "en-job-interview",
        "ar",
        EN,
        (
            T("بدي أتدرب على مقابلة شغل بالإنجليزي", sheet="no", lead=True,
              want="Plays the interviewer: 'Tell me about yourself' with a phrase to start."),
            T("I am a hard worker and I like work in team", sheet="no",
              fix=("working in a team", "to work in a team", "work in a team", "teamwork", "working in teams"),
              want="'I like working in a team' and keeps the interview going."),
            T("كيف بجاوب على what is your weakness؟", sheet="any", want="A real weakness plus how you improve it; one example."),
            T("ما فهمت", sheet="no", simplify=True, want="Simpler, one example."),
        ),
    ),
    Talk(
        "en-phrasal-verbs",
        "ar",
        EN,
        (
            T("شو يعني give up؟", sheet="no", must=("استسلم", "يستسلم", "تستسلم", "توقف", "يبطل", "تبطل", "ترك"),
              want="give up = يستسلم / يبطّل."),
            T("و look after؟", sheet="no", must=("يهتم", "تهتم", "يعتني", "تعتني", "بال", "يرعى", "ينتبه"),
              want="look after = يهتم ب / يدير باله على."),
            T("اعطيني ٤ phrasal verbs بستعملهم كل يوم", sheet="yes", want="Four common ones with meanings on the sheet."),
            T("I will look after my little brother tomorrow", sheet="no", lead=True, right=True,
              want="Right; no correction."),
        ),
    ),
    Talk(
        "en-airport",
        "ar",
        EN,
        (
            T("مسافر على لندن الشهر الجاي بدي جمل للمطار", sheet="any", want="A few airport phrases (check-in, boarding pass, gate)."),
            T("كيف بقول وين بوابة رقم ٥؟", sheet="no", must=("gate",), want="'Where is gate five?'"),
            T("Where I can find the taxi?", sheet="no", fix=("Where can I find",), want="'Where can I find a taxi?'"),
            T("شكراً كثير", sheet="no", want="One line."),
        ),
    ),
    Talk(
        "en-pronunciation",
        "ar",
        EN,
        (
            T("كيف بلفظ comfortable؟", sheet="no", must=("comfortable", "KUMF", "kumf", "كمفتربل", "كمفرتبل"),
              want="Three syllables: KUMF-ter-bl."),
            T("ليش ما بنلفظ الـ k بـ knife؟", sheet="any", must=("silent", "صامت", "ما بتنلفظ", "ما بنلفظ", "بتنكتب"),
              want="kn- at the start: k is silent (knee, know, knock)."),
            T("طيب و Wednesday؟", sheet="no", must=("Wednesday", "Wenz", "وينز"), want="'WENZ-day', the d is silent."),
        ),
    ),
    Talk(
        "en-english-speaker-hard",
        "en",
        EN,
        (
            T("Can you correct me? She have two brothers", sheet="no", fix=("She has",), want="'She has two brothers.'"),
            T("Explain the difference between since and for", sheet="any", must=("since",),
              want="for + length (for five years), since + start point (since 2020)."),
            T("I live here since 5 years", sheet="no", fix=("for five years", "for 5 years"),
              want="'I've lived here for five years.'"),
            T("Thank you, that's clear", sheet="no", want="One line."),
        ),
    ),
    Talk(
        "en-bad-day",
        "ar",
        EN,
        (
            T("اليوم كان سيء، رسبت بامتحان", sheet="no", lead=True,
              want="Short real empathy; no pressure; maybe one gentle phrase like 'I had a bad day'."),
            T("I feel very sad today", sheet="no", right=True, want="Right; kind; no correction."),
            T("كيف بقول بدي أرتاح شوي؟", sheet="no", must=("rest", "break", "relax"), want="'I need a little rest / a break.'"),
        ),
    ),
    Talk(
        "de-doctor-roleplay",
        "ar",
        DE,
        (
            T("خلينا نتمرن إنك مريض وأنا الدكتور", sheet="no", free_language=True,
              want="Plays the patient at once with a simple complaint in German."),
            T("Was fehlt Ihnen?", sheet="no", free_language=True, want="Answers as the patient, simply."),
            T("شو يعني Was fehlt Ihnen؟", sheet="no", must=("مالك", "بك", "المشكلة", "بيوجعك", "بوجعك", "تشكي"),
              want="= شو مالك؟ / شو المشكلة؟ (the doctor's question)."),
            T("كيف بقول خذ الدوا مرتين باليوم؟", sheet="no", must=("zweimal",),
              want="'Nehmen Sie das Medikament zweimal am Tag.'"),
        ),
    ),
    Talk(
        "de-separable-verbs",
        "ar",
        DE,
        (
            T("شو يعني aufstehen؟", sheet="no", must=("يصحى", "يقوم", "أصحى", "تصحى", "يوقف", "صحي", "قوم", "يفيق"),
              want="aufstehen = يقوم من النوم / يصحى."),
            T("Ich stehe um sieben Uhr auf", sheet="no", lead=True, right=True, want="Right; no correction."),
            T("Ich aufstehe früh", sheet="no", fix=("stehe früh auf",), want="'Ich stehe früh auf' (auf goes to the end)."),
            T("اعطيني قاعدة الأفعال اللي بتنفصل", sheet="yes", want="Prefix goes to the end in present; a few examples on the sheet."),
        ),
    ),
    Talk(
        "de-shopping",
        "ar",
        DE,
        (
            T("كيف بسأل بكم هاد؟", sheet="no", must=("kostet",), want="'Was kostet das?' / 'Wie viel kostet das?'"),
            T("Das ist zu teuer", sheet="no", right=True, want="Right; continues the shop scene."),
            T("كيف بقول عندك مقاس أكبر؟", sheet="no", must=("größer", "Größe", "groesser"), want="'Haben Sie das eine Nummer größer?'"),
        ),
    ),
    Talk(
        "de-termin",
        "ar",
        DE,
        (
            T("شو يعني ال Termin اللي بحكوا عنه دايماً", sheet="no", must=("موعد",), want="Termin = موعد."),
            T("كيف بعمل Termin عند الدكتور بالتلفون؟", sheet="any", must=("Termin",),
              want="'Ich möchte einen Termin machen/vereinbaren.' and one more line."),
            T("ما فهمت ولا اشي", sheet="no", simplify=True, want="Simpler, one example."),
            T("اوكي فهمت هلأ", sheet="no", want="One line."),
        ),
    ),
    Talk(
        "en-off-topic-2",
        "ar",
        EN,
        (
            T("شو بتعرفي عن الطب؟", sheet="no", want="Short and honest; turns it back to English practice."),
            T("اعطيني وصفة منسف", sheet="any", want="Brief; turns it into English (ingredients words), no long recipe."),
            T("خلص يلا باي", sheet="no", want="A short goodbye."),
        ),
    ),
    Talk(
        "de-first-day",
        "ar",
        DE,
        (
            T("أول مرة بتعلم ألماني، ولا كلمة بعرف", sheet="no", lead=True, want="Warm; gives 'Hallo, ich heiße …' to say."),
            T("شو يعني Hallo؟", sheet="no", must=("مرحبا", "مرحباً", "أهلا", "اهلا", "هاي"), want="= مرحبا."),
            T("Hallo, ich bin Lina", sheet="no", lead=True, right=True, want="Right; next simple question."),
            T("كيف بقول تشرفت؟", sheet="no", must=("Freut mich", "freut mich"), want="'Freut mich!'"),
        ),
    ),
)

SPLITS = {"dev": DEV, "holdout": HOLDOUT, "all": DEV + HOLDOUT}
