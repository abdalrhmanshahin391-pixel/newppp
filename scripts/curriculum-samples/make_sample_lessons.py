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

G = [
  dict(key="to-be", title='The verb "to be"', title_ar="أنا ريتا", topic="to be: am / is / are", page=2,
    summary="Rita teaches am, is and are with the learner's own life: who they are, how they feel and where they are from, then the negative and yes/no questions.",
    objectives=[
      obj("say-i-am", "Say a sentence about themselves with I am / I'm", "يقول جملة عن نفسه بـ I am",
          "The learner says a correct sentence starting with I am or I'm (name, feeling, job or country).", ["Tell me about you. Who are you?", "How are you today?"], 2),
      obj("use-is", "Use is with he, she or it", "يستخدم is مع he / she / it",
          "The learner says a correct sentence with he is, she is or it is (or he's, she's, it's).", ["Tell me about your friend or someone in your family."]),
      obj("use-are", "Use are with you, we or they", "يستخدم are مع you / we / they",
          "The learner says a correct sentence with we are, they are or you are.", ["Tell me about you and your family together."]),
      obj("negative", "Make a negative with not", "يكوّن جملة نفي",
          "The learner says a correct negative: I'm not, isn't, aren't or is not / are not.", ["Are you tired? Say no with a full sentence."]),
    ],
    plan=plan(["Greet the learner and say: I am Rita. I am your teacher."],
              ["Show I am, you are, he/she/it is with one example each", "Show the short forms I'm, she's, they're"],
              ["Ask the learner to say three sentences about themselves", "Ask about a friend: he is / she is", "Practise negatives: I'm not tired"],
              ["Ask each objective's question and wait for a full sentence"],
              "Arabic has no 'to be' in the present, so learners drop it: 'I happy'. Model 'I am happy' and ask them to repeat."),
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
              "Arabic speakers may say 'he' for objects (هو for كتاب). Correct gently to 'it'."),
    vocabulary=[{"word": p, "meaning_ar": m, "example": e} for p, m, e in GRAMMAR["pages"][1]["table"]],
    image="pronouns", scene="Three friends standing together and waving"),
  dict(key="articles", title='Articles "a" and "an"', title_ar="تفاحة وكتاب", topic="a / an", page=4,
    summary="Rita teaches when to say a and when to say an by listening to the first sound of the word, and using a/an for jobs.",
    objectives=[
      obj("use-a", "Use a before a consonant sound", "يستخدم a قبل الصوت الساكن",
          "The learner says a correct phrase or sentence with a before a consonant sound (a book, a teacher).", ["What is in your bag? Name two things."], 1),
      obj("use-an", "Use an before a vowel sound", "يستخدم an قبل الصوت المتحرك",
          "The learner says a correct phrase or sentence with an before a vowel sound (an apple, an egg, an hour).", ["What fruit do you like? Use an apple or an orange."], 2),
      obj("jobs", "Say a job with a or an", "يذكر مهنة مع a أو an",
          "The learner says a sentence like 'I am a student' or 'She is an engineer' with the right article.", ["What is your job? What is your mother's or father's job?"]),
    ],
    plan=plan(["Ask: What do you have on your table right now?"],
              ["Explain: a + consonant sound, an + vowel sound", "Special cases: an hour, a university"],
              ["Say a word and ask the learner to add a or an", "Talk about jobs: I am a ..., she is an ..."],
              ["Ask each objective's question and wait"],
              "Learners often drop the article: 'I am student'. Model 'I am a student'."),
    vocabulary=[{"word": "a", "meaning_ar": "أداة نكرة قبل الصوت الساكن", "example": "a book"}, {"word": "an", "meaning_ar": "أداة نكرة قبل الصوت المتحرك", "example": "an apple"}],
    image="articles", scene="A boy holding a red apple"),
  dict(key="possessives", title="Possessive adjectives", title_ar="بيتي وعائلتي", topic="my / your / his / her / our / their", page=5,
    summary="Rita teaches my, your, his, her, its, our and their by talking about the learner's family and things.",
    objectives=[
      obj("my-your", "Use my and your", "يستخدم my و your",
          "The learner says a correct sentence with my (e.g. My name is ..., my brother is ...).", ["What's your name? Tell me about your family."], 2),
      obj("his-her", "Use his and her correctly", "يفرّق بين his و her",
          "The learner uses his for a male and her for a female correctly in one sentence.", ["Tell me your father's name and your mother's name with his and her."]),
      obj("our-their", "Use our or their", "يستخدم our أو their",
          "The learner says a correct sentence with our or their.", ["Tell me about your home. Say our house ..."]),
    ],
    plan=plan(["Ask: What's your name? What's your friend's name?"],
              ["Match each pronoun to its possessive: I-my, he-his, she-her", "Possessives don't change for plurals: my books"],
              ["Ask about family members using his and her", "Talk about home with our"],
              ["Ask each objective's question and wait"],
              "his/her follow the owner, not the thing (Arabic matches the thing). Correct 'her father' vs 'his father' by asking who owns it."),
    vocabulary=[{"word": w, "meaning_ar": "", "example": e} for _, w, e in GRAMMAR["pages"][3]["table"]],
    image="possessives", scene="A girl pointing at herself next to a small house with a heart"),
  dict(key="present-simple", title="Present simple", title_ar="يومي العادي", topic="present simple routines", page=6,
    summary="Rita teaches the present simple for daily routines: I work, she works, don't/doesn't and do/does questions.",
    objectives=[
      obj("routine", "Describe a daily routine with I", "يصف روتينه اليومي",
          "The learner says a correct present simple sentence about their routine (e.g. I drink tea every morning).", ["What do you do every morning?"], 2),
      obj("third-person-s", "Add -s with he or she", "يضيف -s مع he / she",
          "The learner says a sentence with he or she and the verb ending in -s / -es (she works, he goes).", ["What does your mother or father do every day?"], 2),
      obj("negative-dont", "Make a negative with don't or doesn't", "ينفي بـ don't / doesn't",
          "The learner says a correct negative with don't or doesn't + base verb.", ["What don't you like to eat?"]),
    ],
    plan=plan(["Ask: What time do you wake up?"],
              ["Show I work / she works", "Show don't and doesn't, and do/does questions"],
              ["Ask about the learner's day", "Ask about a family member's day to practise -s"],
              ["Ask each objective's question and wait"],
              "The most common mistake is dropping -s: 'she work'. Ask them to repeat with -s."),
    vocabulary=[{"word": "every day", "meaning_ar": "كل يوم", "example": "I study every day."}, {"word": "usually", "meaning_ar": "عادةً", "example": "I usually drink tea."}, {"word": "never", "meaning_ar": "أبداً", "example": "He never drinks coffee."}],
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

def vocab_lessons():
    out = []
    for v in V:
        page = VOCAB["pages"][v["voc"]]
        words = [{"word": w, "meaning_ar": m, "example": e} for w, m, e in page["words"]]
        out.append({"image_url": f"/curriculum/{v['key'] if v['key'] != 'yes-no' else 'great-idea'}.svg", "lesson": {
            "title": v["title"], "title_ar": v["title_ar"], "topic": v["topic"],
            "source_from_page": v["page"], "source_to_page": v["page"], "summary": v["summary"],
            "objectives": v["objectives"],
            "plan": plan(["Greet the learner warmly and say today's words are about " + v["topic"]],
                         ["Say four or five key words with their Arabic meaning", "Use each in a short example"],
                         ["Role-play a short everyday situation", "Swap roles so the learner starts"],
                         ["Ask each objective's question and wait"],
                         "Keep it playful. If the learner answers in Arabic, give the English and ask them to repeat it."),
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
