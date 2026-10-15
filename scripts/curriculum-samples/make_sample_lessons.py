"""Writes the sample window summaries and lessons for the two sample books.

Run: python3 scripts/curriculum-samples/make_sample_lessons.py
Import the files in /admin/curricula (summary first, then lessons).
"""
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sample_books import GRAMMAR, VOCAB

OUT = str(Path(__file__).resolve().parents[2] / "docs" / "curriculum-samples")
strip = lambda s: re.sub(r"<[^>]+>", "", s)

def summary(book, kind, lesson_titles_ar):
    topics, suggested = [], []
    for i, p in enumerate(book["pages"]):
        page = i + 2
        t = {"title": p["title"].replace("“", '"').replace("”", '"'), "title_ar": p["title_ar"], "from_page": page, "to_page": page}
        if kind == "grammar":
            t["key_points"] = [p["intro"]] + [strip(r) for r in p["rules"]]
            t["examples"] = [e for e, _ in p["examples"]]
            t["vocabulary"] = []
        else:
            t["key_points"] = [f"{len(p['words'])} everyday words and phrases for {p['title'].lower()}"]
            t["examples"] = [e for _, _, e in p["words"][:4]]
            t["vocabulary"] = [{"word": w, "meaning_ar": m, "example": e} for w, m, e in p["words"]]
        topics.append(t)
        suggested.append({"topic": t["title"], "title_ar": lesson_titles_ar[i], "from_page": page, "to_page": page})
    if kind == "grammar":
        overview = "Five A1 grammar rules, one per page: the verb to be, subject pronouns, the articles a/an, possessive adjectives and the present simple. Each page gives the form, rules to remember, examples and practice."
        overview_ar = "خمس قواعد للمستوى A1، قاعدة في كل صفحة: فعل الكينونة، الضمائر، أداتا a/an، صفات الملكية، والمضارع البسيط. لكل قاعدة جدول وأمثلة وتمارين."
    else:
        overview = "Five A1 word units, one per page, each with twelve everyday words or phrases, their Arabic meaning and an example: greetings, introducing yourself, polite words, yes/no answers and feelings."
        overview_ar = "خمس وحدات كلمات للمستوى A1، في كل صفحة اثنتا عشرة كلمة مع المعنى ومثال: التحية، التعريف بالنفس، كلمات المجاملة، نعم ولا، والمشاعر."
    return {"from_page": 1, "to_page": 6, "summary": {
        "overview": overview, "overview_ar": overview_ar, "topics": topics,
        "suggested_lessons": suggested, "continues_next_window": False}}

def plan(warm, teach, practice, check, notes):
    return {"phases": [
        {"phase": "warmup", "minutes": 1, "steps": warm},
        {"phase": "teach", "minutes": 2, "steps": teach},
        {"phase": "practice", "minutes": 3, "steps": practice},
        {"phase": "check", "minutes": 2, "steps": check},
        {"phase": "wrap", "minutes": 1, "steps": ["Praise one thing the learner did well", "Say one sentence that sums up the lesson"]},
    ], "teacher_notes": notes}

def obj(id, text, text_ar, criteria, prompts, weight=1):
    return {"id": id, "text": text, "text_ar": text_ar, "criteria": criteria, "check_prompts": prompts, "weight": weight}

POSSESSIVE_AR = {
    "my": "ـي (لي)", "your": "ـك / ـكم", "his": "ـه (لمذكر)", "her": "ـها (لمؤنث)",
    "its": "ـه / ـها (لغير العاقل)", "our": "ـنا", "their": "ـهم / ـهن",
}

G = [
  dict(key="to-be", title='The verb "to be"', title_ar="أنا ريتا", topic="to be: am / is / are", page=2,
    summary="Rita teaches am, is and are with the learner's own life: who they are, how they feel and where they are from, then the negative and yes/no questions with short answers.",
    objectives=[
      obj("say-i-am", "Say a sentence about themselves with I am / I'm", "يقول جملة عن نفسه بـ I am",
          "The learner says a correct sentence starting with I am or I'm (name, feeling, job or country).", ["Tell me about you. Who are you?", "How are you today?"], 2),
      obj("use-is", "Use is with he, she or it", "يستخدم is مع he / she / it",
          "The learner says a correct sentence with he is, she is or it is (or he's, she's, it's).", ["Tell me about your friend or someone in your family."]),
      obj("use-are", "Use are with you, we or they", "يستخدم are مع you / we / they",
          "The learner says a correct sentence with we are, they are or you are.", ["Tell me about you and your family together."]),
      obj("negative", "Make a negative with not", "يكوّن جملة نفي",
          "The learner says a correct negative: I'm not, isn't, aren't or is not / are not.", ["Are you tired? Say no with a full sentence."]),
      obj("question", "Ask or answer a yes/no question with to be", "يسأل أو يجيب بسؤال نعم/لا",
          "The learner asks a correct question (Are you ...? / Is she ...?) or gives a correct short answer (Yes, I am. / No, she isn't.).",
          ["Are you a student? Answer with a short answer.", "Now ask me a question. Start with: Are you ...?"]),
    ],
    plan=plan(["Greet the learner and say: I am Rita. I am your teacher."],
              ["Show I am, you are, he/she/it is with one example each", "Show the short forms I'm, she's, they're", "Show questions with the verb first (Are you ...? Is he ...?) and the short answers Yes, I am. / No, she isn't."],
              ["Ask the learner to say three sentences about themselves", "Ask about a friend: he is / she is", "Practise negatives: I'm not tired", "Swap: the learner asks Rita Are you ...? questions"],
              ["Ask each objective's question and wait for a full sentence"],
              "Arabic has no 'to be' in the present, so learners drop it: 'I happy'. Model 'I am happy' and ask them to repeat. Another common slip is 'I am agree' (from أنا موافق): say 'I agree'."),
    vocabulary=[{"word": "am", "meaning_ar": "أكون (مع I)", "example": "I am Rita."}, {"word": "is", "meaning_ar": "يكون (مع he/she/it)", "example": "She is my friend."}, {"word": "are", "meaning_ar": "يكون (مع you/we/they)", "example": "We are from Jordan."}],
    image="to-be", scene="A smiling girl pointing at herself with a speech bubble"),
  dict(key="pronouns", title="Subject pronouns", title_ar="هو وهي ونحن", topic="subject pronouns", page=3,
    summary="Rita teaches I, you, he, she, it, we and they by replacing names with pronouns in short spoken sentences.",
    objectives=[
      obj("he-she", "Replace a person's name with he or she", "يستبدل الاسم بـ he أو she",
          "Given a name, the learner says a sentence using he or she correctly (e.g. Omar is tall → He is tall).", ["Omar is tall. Say it with he or she.", "Sara is a doctor. Say it again with a pronoun."], 2),
      obj("it-things", "Use it for a thing or an animal", "يستخدم it للأشياء والحيوانات",
          "The learner says a sentence using it for a thing or an animal.", ["Tell me about your phone or your cat."]),
      obj("we-they", "Use we and they for groups", "يستخدم we و they للجماعة",
          "The learner says a correct sentence with we or they for more than one person.", ["Ali and Sami are friends. Say it with they.", "You and I are students. Say it with we."]),
    ],
    plan=plan(["Ask: Who is your best friend? What is his or her name?"],
              ["Say each pronoun with one short example", "Explain: it is for things and animals"],
              ["Give a name and ask the learner to replace it", "Mix single people, groups and things"],
              ["Ask each objective's question and wait"],
              "Arabic nouns have gender (كتاب = هو, سيارة = هي), so learners may say 'he' or 'she' for objects. Correct gently to 'it'. Pets and babies can be he/she when we know them, but 'it' is the safe choice for beginners."),
    vocabulary=[{"word": p, "meaning_ar": m, "example": e} for p, m, e in GRAMMAR["pages"][1]["table"]],
    image="pronouns", scene="Three friends standing together and waving"),
  dict(key="articles", title='Articles "a" and "an"', title_ar="تفاحة وكتاب", topic="a / an", page=4,
    summary="Rita teaches when to say a and when to say an by listening to the first sound of the word, and using a/an for jobs.",
    objectives=[
      obj("use-a", "Use a before a consonant sound", "يستخدم a قبل صوت صامت (consonant)",
          "The learner says a correct phrase or sentence with a before a consonant sound (a book, a teacher).", ["What is in your bag? Name two things."], 1),
      obj("use-an", "Use an before a vowel sound", "يستخدم an قبل صوت صائت (vowel)",
          "The learner says a correct phrase or sentence with an before a vowel sound (an apple, an egg, an hour).", ["What fruit do you like? Use an apple or an orange."], 2),
      obj("jobs", "Say a job with a or an", "يذكر مهنة مع a أو an",
          "The learner says a sentence like 'I am a student' or 'She is an engineer' with the right article.", ["What is your job? What is your mother's or father's job?"]),
    ],
    plan=plan(["Ask: What do you have on your table right now?"],
              ["Explain: a + consonant sound, an + vowel sound", "Special cases: an hour, a university", "Remind: no a/an with plurals (cats, not a cats)"],
              ["Say a word and ask the learner to add a or an", "Talk about jobs: I am a ..., she is an ..."],
              ["Ask each objective's question and wait"],
              "Arabic has no indefinite article (كتاب = a book), so learners often drop it: 'I am student'. Model 'I am a student'. Stress that the rule is about the sound, not the letter: an hour, a university."),
    vocabulary=[{"word": "a", "meaning_ar": "أداة نكرة قبل صوت صامت (consonant)", "example": "a book"}, {"word": "an", "meaning_ar": "أداة نكرة قبل صوت صائت (vowel)", "example": "an apple"}],
    image="articles", scene="A boy holding a red apple"),
  dict(key="possessives", title="Possessive adjectives", title_ar="بيتي وعائلتي", topic="my / your / his / her / our / their", page=5,
    summary="Rita teaches my, your, his, her, its, our and their by talking about the learner's family and things.",
    objectives=[
      obj("my-your", "Use my and your", "يستخدم my و your",
          "The learner says a correct sentence with my (e.g. My name is ...) and also uses your correctly in a question or sentence (e.g. What's your name?).",
          ["What's your name? Tell me about your family.", "Now ask me a question about me. Start with: What's your ...?"], 2),
      obj("his-her", "Use his and her correctly", "يفرّق بين his و her",
          "The learner uses his for a male and her for a female correctly in one sentence.", ["Tell me your father's name and your mother's name with his and her."]),
      obj("our-their", "Use our or their", "يستخدم our أو their",
          "The learner says a correct sentence with our or their.", ["Tell me about your home. Say our house ..."]),
    ],
    plan=plan(["Ask: What's your name? What's your friend's name?"],
              ["Match each pronoun to its possessive: I-my, he-his, she-her", "Show where it goes: my book (not book my)", "Possessives don't change for plurals: my books"],
              ["Ask about family members using his and her", "Talk about home with our"],
              ["Ask each objective's question and wait"],
              "In Arabic the possessive is attached to the end of the noun (كتابي, بيتنا), so learners say 'book my' or 'house our'. In English it comes before the noun: my book. his/her follow the owner, as in Arabic (أبوه / أبوها): when a learner mixes them up, ask 'Who owns it? A boy or a girl?'. Also stress its (no apostrophe) vs it's = it is."),
    vocabulary=[{"word": w, "meaning_ar": POSSESSIVE_AR[w], "example": e} for _, w, e in GRAMMAR["pages"][3]["table"]],
    image="possessives", scene="A girl pointing at herself next to a small house with a heart"),
  dict(key="present-simple", title="Present simple", title_ar="يومي العادي", topic="present simple routines", page=6,
    summary="Rita teaches the present simple for daily routines: I work, she works, don't/doesn't and do/does questions.",
    objectives=[
      obj("routine", "Describe a daily routine with I", "يصف روتينه اليومي",
          "The learner says a correct present simple sentence about their routine (e.g. I drink tea every morning).", ["What do you do every morning?"], 2),
      obj("third-person-s", "Add -s with he or she", "يضيف -s مع he / she",
          "The learner says a sentence with he or she and the verb ending in -s / -es (she works, he goes).", ["What does your mother or father do every day?"], 2),
      obj("negative-dont", "Make a negative with don't or doesn't", "ينفي بـ don't / doesn't",
          "The learner says a correct negative with don't or doesn't + base verb (I don't like fish. / She doesn't work on Friday.).",
          ["Tell me one food you don't like. Use a full sentence.", "Tell me one thing your brother or sister doesn't do."]),
      obj("question-do", "Ask a question with do or does", "يسأل بـ do / does",
          "The learner asks a correct question: Do you ...? / Does she ...? (with the base verb, no -s after does).",
          ["Ask me a question about my day. Start with: Do you ...?"]),
    ],
    plan=plan(["Ask: What time do you wake up?"],
              ["Show I work / she works", "Show don't and doesn't, and do/does questions"],
              ["Ask about the learner's day", "Ask about a family member's day to practise -s"],
              ["Ask each objective's question and wait"],
              "The most common mistake is dropping -s: 'she work'. Arabic verbs change for every person, so learners often forget that English changes only for he/she/it. Also watch 'she doesn't works' and 'Does she works?': after does/doesn't the verb stays plain. Ask them to repeat the correct sentence."),
    vocabulary=[{"word": "every day", "meaning_ar": "كل يوم", "example": "I study every day."}, {"word": "usually", "meaning_ar": "عادةً", "example": "I usually drink tea."}, {"word": "always", "meaning_ar": "دائماً", "example": "She always walks to school."}, {"word": "never", "meaning_ar": "أبداً", "example": "He never drinks coffee."}],
    image="present-simple", scene="A boy waving in the morning with a cup of tea"),
]

V = [
  dict(key="hello", title="Hello & Goodbye", title_ar="مرحبا", topic="greetings", page=2, voc=0,
    summary="Rita practises saying hello, asking How are you?, answering, and saying goodbye at different times of day.",
    objectives=[
      obj("greet", "Greet Rita and ask how she is", "يحيّي ريتا ويسأل عن حالها",
          "The learner says a greeting (hello / hi / good morning ...) and asks How are you?", ["Imagine you meet me in the morning. What do you say?"], 2),
      obj("answer-how", "Answer How are you?", "يجيب على How are you?",
          "The learner answers with a phrase like I'm fine, thank you.", ["How are you today?"]),
      obj("goodbye", "Say goodbye", "يودّع",
          "The learner says goodbye / see you later / good night.", ["It is late and you are going home. What do you say?"]),
    ]),
  dict(key="me-and-you", title="Me & You", title_ar="أنا وأنت", topic="introducing yourself", page=3, voc=1,
    summary="Rita helps the learner introduce themselves: name, country, city, age and job, and ask the same questions back.",
    objectives=[
      obj("my-name", "Say their name", "يقول اسمه",
          "The learner says My name is ... or I'm ...", ["What's your name?"], 2),
      obj("from", "Say where they are from", "يقول من أين هو",
          "The learner says I'm from ... or I live in ...", ["Where are you from?"]),
      obj("ask-back", "Ask Rita a question about her", "يسأل ريتا سؤالاً عنها",
          "The learner asks a question like What's your name? / Where are you from? / How old are you?", ["Now you ask me a question."]),
    ]),
  dict(key="thank-you", title="Thank you & Please", title_ar="شكراً", topic="polite words", page=4, voc=2,
    summary="Rita practises please, thank you, sorry, excuse me and the replies you're welcome and no problem.",
    objectives=[
      obj("ask-please", "Ask for something with please", "يطلب شيئاً مع please",
          "The learner asks for something using please (e.g. A glass of water, please / Can I ..., please?).", ["You are thirsty in a café. Ask for water."], 2),
      obj("thank", "Thank someone", "يشكر",
          "The learner says thank you or thanks.", ["I give you a gift. What do you say?"]),
      obj("reply-welcome", "Reply to thank you", "يرد على الشكر",
          "The learner replies with You're welcome / No problem.", ["Thank you for your help! What do you say back?"]),
    ]),
  dict(key="yes-no", title="Yes, No & Great idea!", title_ar="فكرة عظيمة!", topic="agreeing and answering", page=5, voc=3,
    summary="Rita practises answering with yes, no, maybe and sure, suggesting with Let's ... and replying Great idea!",
    objectives=[
      obj("yes-no-answer", "Answer a question with yes or no and a short reason", "يجيب بنعم أو لا",
          "The learner answers a yes/no question with yes or no plus a few more words.", ["Do you like coffee?", "Are you ready?"]),
      obj("suggest", "Make a suggestion with Let's", "يقترح بـ Let's",
          "The learner says a suggestion starting with Let's (e.g. Let's play football).", ["It is the weekend. What can we do together?"], 2),
      obj("react", "React with Great idea! or I agree", "يتفاعل مع الاقتراح",
          "The learner replies to a suggestion with Great idea!, I agree, sure or OK.", ["Let's eat pizza tonight! What do you say?"]),
    ]),
  dict(key="busy", title="I'm busy", title_ar="أنا مشغول", topic="feelings and being busy", page=6, voc=4,
    summary="Rita practises saying how you feel and whether you are busy or free: tired, happy, hungry, ready, late.",
    objectives=[
      obj("feeling", "Say how they feel", "يعبّر عن شعوره",
          "The learner says I'm + a feeling word (tired, happy, hungry, sad, bored ...).", ["How do you feel right now?"], 2),
      obj("busy-free", "Say if they are busy or free", "يقول إن كان مشغولاً أو متفرغاً",
          "The learner says I'm busy or I'm free (with a time if possible).", ["Are you free on Friday?"]),
      obj("later", "Put off a plan politely", "يؤجل بلطف",
          "The learner says something like Sorry, I'm busy now. Talk to you later.", ["Let's talk now! (You are busy.) What do you say?"]),
    ]),
]

VOCAB_PLANS = {
    "hello": (
        ["Greet the learner with the right greeting for the time of day and ask: How are you?"],
        ["Teach hello / hi and good morning, good afternoon, good evening with the time of day each one fits", "Teach How are you? and the answers I'm fine, thank you", "Teach goodbye, see you later and good night"],
        ["Role-play meeting in the morning, then saying goodbye in the evening", "Swap roles so the learner starts the greeting"],
        ["Ask each objective's question and wait"],
        "Good evening is for meeting someone; good night is for leaving or going to bed, and learners often swap them. Arabic uses مساء الخير for both afternoon and evening. If the learner answers in Arabic, give the English and ask them to repeat it."),
    "me-and-you": (
        ["Say: My name is Rita. I'm from Jordan. Then ask: What's your name?"],
        ["Model the three sentences: My name is ... / I'm from ... / I'm ... years old", "Teach the matching questions: What's your name? Where are you from? How old are you?"],
        ["Interview the learner with the three questions", "Swap roles: the learner interviews Rita", "Add friend, student, teacher or family: This is my friend, Ali."],
        ["Ask each objective's question and wait"],
        "Learners often say 'My age is 20' or 'I have 20 years'. Model 'I'm twenty years old.' Remember I am / I'm: learners drop it (I from Jordan)."),
    "thank-you": (
        ["Set the scene: you are in a café. Say: Hello! What would you like?"],
        ["Teach please at the end of a request: A glass of water, please.", "Teach thank you / thanks and the replies you're welcome / no problem", "Teach sorry (for a mistake) and excuse me (to get attention or to pass)"],
        ["Role-play ordering in a café, swapping roles", "Practise Can I ...? and Of course", "Say 'Pardon?' when the learner speaks too fast so they ask you to repeat"],
        ["Ask each objective's question and wait"],
        "Thanks is informal; thank you is safe everywhere. Learners mix up sorry (a mistake) and excuse me (getting attention). Keep the tone warm and polite."),
    "yes-no": (
        ["Ask three quick questions: Do you like tea? Are you ready? Is it Friday?"],
        ["Teach yes / no / maybe and short answers: Yes, I do. / No, I don't. / Yes, I am.", "Teach suggestions with Let's ... and the replies Great idea!, I agree, Sure, OK"],
        ["Rita suggests an activity; the learner answers with Great idea! or Maybe later", "Swap: the learner suggests with Let's ... and Rita reacts", "Add right / wrong when you correct something"],
        ["Ask each objective's question and wait"],
        "Learners often answer Do you like ...? with 'Yes, I like'. Model the short answer 'Yes, I do.' Encourage more than a bare yes or no."),
    "busy": (
        ["Ask: How do you feel today? Are you busy or free?"],
        ["Teach feeling words with I'm: tired, happy, sad, hungry, thirsty, bored, ready", "Teach busy / free and the polite postpone: Sorry, I'm busy now. Talk to you later."],
        ["Mime a feeling and let the learner guess: Are you tired?", "Role-play a friend inviting the learner while they are busy", "Ask: Are you free on Friday?"],
        ["Ask each objective's question and wait"],
        "Feelings use I'm + the word (I'm tired). Learners drop I'm (I busy): model the full sentence. Free here means 'not busy', not 'costing nothing'."),
}

def vocab_lessons():
    out = []
    for v in V:
        page = VOCAB["pages"][v["voc"]]
        words = [{"word": w, "meaning_ar": m, "example": e} for w, m, e in page["words"]]
        out.append({"image_url": f"/curriculum/{v['key'] if v['key'] != 'yes-no' else 'great-idea'}.svg", "lesson": {
            "title": v["title"], "title_ar": v["title_ar"], "topic": v["topic"],
            "source_from_page": v["page"], "source_to_page": v["page"], "summary": v["summary"],
            "objectives": v["objectives"],
            "plan": plan(*VOCAB_PLANS[v["key"]]),
            "vocabulary": words,
            "image_prompt": f"A friendly cartoon character showing '{v['title']}'"}})
    return out

def grammar_lessons():
    out = []
    for g in G:
        out.append({"image_url": f"/curriculum/{g['image']}.svg", "lesson": {
            "title": g["title"], "title_ar": g["title_ar"], "topic": g["topic"],
            "source_from_page": g["page"], "source_to_page": g["page"], "summary": g["summary"],
            "objectives": g["objectives"], "plan": g["plan"], "vocabulary": g["vocabulary"],
            "image_prompt": g["scene"]}})
    return out

json.dump(summary(GRAMMAR, "grammar", [g["title_ar"] for g in G]), open(f"{OUT}/a1-english-grammar.summary.json", "w"), ensure_ascii=False, indent=2)
json.dump(summary(VOCAB, "vocab", [v["title_ar"] for v in V]), open(f"{OUT}/a1-english-words.summary.json", "w"), ensure_ascii=False, indent=2)
json.dump(grammar_lessons(), open(f"{OUT}/a1-english-grammar.lessons.json", "w"), ensure_ascii=False, indent=2)
json.dump(vocab_lessons(), open(f"{OUT}/a1-english-words.lessons.json", "w"), ensure_ascii=False, indent=2)
print("ok")
