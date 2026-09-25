export type Bi = { en: string; ar: string };
export type BiList = { en: string[]; ar: string[] };

export type TourStep = {
  id: string;
  targetSelector: string;
  fallbackSelector?: string;
  title: Bi;
  description: Bi;
  bullets?: BiList;
  actionPrompt?: {
    label: Bi;
    actionId: string;
  };
};

export type PageTourDef = {
  toolKey: string;
  title: Bi;
  steps: TourStep[];
};

export const TOURS: Record<string, PageTourDef> = {
  /* =========================================================================
     1. FLASHCARDS & STUDY SPACE (/study)
     ========================================================================= */
  flashcards: {
    toolKey: "flashcards",
    title: { en: "Mastering Your Flashcards & Study Space", ar: "الدليل الشامل لاستخدام البطاقات ومساحة الدراسة" },
    steps: [
      {
        id: "shelf",
        targetSelector: '[data-tour="subject-shelf"]',
        fallbackSelector: '[data-tour="subject-shelf-header"], main',
        title: {
          en: "Hierarchical Subject Shelf & Smart Topic Picker",
          ar: "رف المواد الهيكلي، البحث الفوري وتحديد الموضوعات",
        },
        description: {
          en: "This is your primary academic repository. Every course is organized into high-level subjects with nested lectures, designed to build clear cognitive maps for medical studies.",
          ar: "هذا هو المستودع الأكاديمي الرئيسي لبطاقاتك؛ تنظم فيه المواد الكبرى ومحاضراتها الفرعية لبناء روابط معرفية راسخة للمواد الطبية.",
        },
        bullets: {
          en: [
            "1. Instant Smart Search: Type any lecture topic, disease name, or drug in the search bar ('Search subjects and sub-subjects...') to filter your entire board instantly.",
            "2. '+ New' Subject Button: Fast header button to create a brand-new top-level course or clinical rotation module.",
            "3. Expandable Subject Card ('Sample subject — Cardiology'): Click anywhere on the course card to expand or collapse its list of nested sub-subjects and chapters.",
            "4. Topic & Card Counters ('0 of 2 sub-subjects selected · 10 cards'): Displays live counts of selected topics and total cards stored inside this subject.",
            "5. '+ sub-subject' Shortcut: Directly nest a new chapter or lecture block into this subject without leaving your place.",
            "6. Multi-Topic Checkboxes: Tick one or multiple sub-subjects across different courses to generate integrated interdisciplinary study sessions (e.g. Cardiology Pathology + Pharmacology).",
          ],
          ar: [
            "١. شريط البحث الذكي الفوري: ابحث عن أي اسم مرض، دواء، أو عنوان محاضرة ('Search subjects and sub-subjects...') لتصفية كامل محتواك فوراً.",
            "٢. زر إضافة مادة (+ New): زر برتقالي علوي لإنشاء مقرر دراسي جديد أو مادة إكلينيكية مباشرة بضغطة واحدة.",
            "٣. بطاقة المادة الرئيسية ('Cardiology'): اضغط على البطاقة لفتح أو طي قائمة المحاضرات والفصول الفرعية التابعة لها.",
            "٤. عداد الاختيار والبطاقات الحية ('0 of 2 selected · 10 cards'): يوضح عدد المحاضرات المحددة للمذاكرة الآن وإجمالي البطاقات داخل المادة.",
            "٥. زر (+ sub-subject): لإضافة محاضرة جديدة أو فصل دراسي فرعي داخل المادة مباشرة دون خطوات معقدة.",
            "٦. مربعات التحديد للدمج المتعدد: حدد عدة محاضرات من مواد مختلفة (مثل باثولوجي القلب + فارماكولوجي) لتكوين جلسة دراسة تكاملية شاملة.",
          ],
        },
      },
      {
        id: "rail",
        targetSelector: '[data-tour="study-rail"]',
        fallbackSelector: "aside",
        title: {
          en: "Left Rail: Rapid Curriculum & Deck Actions",
          ar: "شريط الأدوات الجانبي: إدارة وهيكلة المواد بسرعة",
        },
        description: {
          en: "The vertical side rail provides fast, single-click shortcuts to build, organize, and manage your study modules.",
          ar: "يوفر الشريط الجانبي أدوات تحكم فورية وسريعة لبناء مقرراتك، وتنظيم فصولك، وتعديل بطاقاتك بضغطة واحدة.",
        },
        bullets: {
          en: [
            "1. Add Subject (New - Apricot): Establishes new major courses and disciplines (e.g. Cardiology, Pharmacology, Pathology).",
            "2. Add Sub-Subject (Nest - Sky): Nests specific chapters, lectures, or diagnostic units inside the currently selected subject.",
            "3. Remove (Delete - Clay): Safely deletes a selected chapter or subject with confirmation dialog to prevent accidental loss.",
            "4. Edit (Rename - Lilac): Instantly renames subjects or sub-topics to keep your syllabus titles clean and structured.",
            "5. Authoring Mode Tools: Switching to Edit View also unlocks 'Add flashcards', 'View flashcards', and the 'Make cards from material' AI generator.",
          ],
          ar: [
            "١. إضافة مادة (Add subject - برتقالي): إنشاء المقررات الدراسية والفروع الطبية الكبرى (مثل التشريح، الباطنة، الأطفال).",
            "٢. إضافة مادة فرعية (Add sub-subject - سماوي): تفريع المحاضرات والفصول الدراسية داخل المادة المختارة.",
            "٣. حذف (Remove - أحمر طيني): لحذف المحاضرة أو المادة المحددة بأمان مع نافذة تأكيد لمنع الحذف بالخطأ.",
            "٤. تعديل الاسم (Edit - بنفسجي): لإعادة تسمية المواد أو المحاضرات لتنظيم فهرس المنهج وتحديثه بدقة.",
            "٥. أدوات وضع التحرير: عند التبديل لوضع التعديل، يفتح هذا الشريط أيضاً أدوات كتابة البطاقات، والمعرض، واستخراج البطاقات بالذكاء الاصطناعي.",
          ],
        },
      },
      {
        id: "start-session",
        targetSelector: '[data-tour="start-session"]',
        fallbackSelector: '[data-tour="launch-panel"], aside:has(button)',
        title: {
          en: "Start a Session: Modes, Scope & SM-2 Review",
          ar: "بدء الجلسة: أنماط المذاكرة، التصفية وخوارزمية SM-2",
        },
        description: {
          en: "This launchpad prepares your study deck and lets you choose how to practice — from zero-stakes casual practice to scientific SM-2 spaced repetition.",
          ar: "لوحة انطلاق جلسة المذاكرة؛ تجهز حزمة البطاقات المختارة وتتيح لك الاختيار بين التدريب الحر أو المراجعة التكرارية المتباعدة بنظام SM-2.",
        },
        bullets: {
          en: [
            "1. Readiness Counter ('10 cards ready'): Shows the aggregate count of flashcards ready to review from your ticked subjects (or entire board).",
            "2. Scope & Status Breakdown: Displays source scope ('From: your whole board'), cards due right now by schedule ('Due now: 7'), and marked cards ('Flagged: 0').",
            "3. 'All ticked' vs 'Flagged' Tabs: Switch between studying every card in your selection or isolating only cards you flagged for difficulty.",
            "4. 'Study mode': Free practice run that lets you flip through cards at your own pace without altering your spaced repetition intervals.",
            "5. 'Shuffle and study': Randomizes card order to prevent serial position memory bias and simulate realistic clinical exam recall.",
            "6. 'Smart review' (SuperMemo SM-2): Scientifically optimized spaced repetition session; calculates interval expansions based on your rating (Again, Hard, Good, Easy).",
          ],
          ar: [
            "١. إجمالي الجاهزية ('10 cards ready'): مجموع البطاقات الجاهزة للمذاكرة وفق ما قمت بتحديده (أو كامل اللوحة إذا لم تحدد شيئاً).",
            "٢. تفاصيل الحزمة المصدرية: يوضح مصدر البطاقات ('From')، والمستحق للمراجعة اليوم ('Due now: 7')، والبطاقات المميزة بنجمة ('Flagged: 0').",
            "٣. تبويب 'All ticked' مقابل 'Flagged': للتبديل الفوري بين دراسة كل البطاقات المحددة، أو التركيز حصراً على البطاقات الصعبة المعلمة براية.",
            "٤. زر وضع الدراسة (Study mode): مراجعة تجريبية حرة ومفتوحة لتصفح البطاقات دون التأثير على مواعيد خوارزمية التكرار المتباعد.",
            "٥. خلط البطاقات (Shuffle and study): يبعثر ترتيب البطاقات لكسر الحفظ النمطي وتدريب العقل على الاستدعاء المفاجئ للمعلومة.",
            "٦. المراجعة الذكية (Smart review بخوارزمية SM-2): النظام العلمي للتكرار المتباعد؛ يقدم لك البطاقات في موعد نسيانها ويبرمج موعدها القادم بناءً على تقييمك (Again, Hard, Good, Easy).",
          ],
        },
      },
      {
        id: "daily-schedule",
        targetSelector: '[data-tour="daily-schedule"]',
        fallbackSelector: '[data-tour="launch-panel"] > div:last-child, main div:last-child',
        title: {
          en: "Today's Schedule, Daily Goal & 30-Day Forecast",
          ar: "جدول اليوم، الهدف اليومي والتنبؤ لـ 30 يوماً القادمة",
        },
        description: {
          en: "Your morning repetition cockpit. Keeps you consistent, highlights what is due today, tracks daily quotas, and forecasts upcoming exam workload.",
          ar: "لوحة التحكم اليومية للتكرار المتباعد؛ تحافظ على استمراريتك، وتحدد البطاقات المستحقة اليوم، وتتنبأ بحجم المراجعات للأيام القادمة.",
        },
        bullets: {
          en: [
            "1. Cards Due Today ('7 cards due right now · 2 new mixed in'): Highlights cards that have reached their optimal forgetting curve threshold, mixing in new unstudied cards.",
            "2. 'Review everything due' Button: Primary master action to launch an immediate SM-2 session for all due cards across your library.",
            "3. Daily Goal Tracker ('DAILY GOAL 8/20'): Progress bar showing completed cards against your target quota, indicating remaining cards needed.",
            "4. Weekly Consistency Dots: 7-day indicators tracking your daily completion streak to build compounding study habits.",
            "5. Next 30 Days Forecast Chart: Predictive histogram showing upcoming review volume ('Busiest day ahead: 5 cards') so you can plan ahead.",
            "6. Retention Tuner ('How tight should the schedule be?'): Customize target memory retention between Relaxed (85%), Balanced (90%), or Exam-tight (95%).",
            "7. 'See my progress' Link: Jump directly to `/study/progress` for deep analytics on hard cards, leeches, and average ease factors.",
          ],
          ar: [
            "١. المستحق للمراجعة اليوم ('7 cards due · 2 new'): يوضح البطاقات المطلوب مراجعتها فوراً لمنع تلاشي المعلومات مع دمج بطاقات جديدة تدريجياً.",
            "٢. زر مراجعة كل المستحق (Review everything due): الزر الأخضر الرئيسي لبدء جلسة مراجعة تكرارية شاملة لكل ما استحق موعده بضغطة واحدة.",
            "٣. شريط الهدف اليومي (Daily Goal 8/20): مقياس بصري يوضح ما أنجزته من هدفك اليومي (مثلاً 20 بطاقة) وعدد البطاقات المتبقية لإتمامه.",
            "٤. نقاط أيام الأسبوع (Streak Dots): متابعة الاستمرارية اليومية عبر إضاءة الأيام التي حققت فيها هدفك الدراسي.",
            "٥. رسم التنبؤ لـ 30 يوماً (Next 30 Days): أعمدة بيانية توضح ضغط المراجعات المتوقع خلال الشهر القادم ('Busiest day ahead') لتنظيم وقتك قبل الامتحانات.",
            "٦. ضبط دقة التكرار المتباعد: اختيار نسبة تثبيت الحفظ المستهدفة بين مرن (85%)، متوازن (90%)، أو مشدد للاختبارات (95%).",
            "٧. رابط تقدمي الدراسي (See my progress): ينقلك لصفحة التحليلات المتقدمة لمتابعة البطاقات المستعصية ومعدل السهولة.",
          ],
        },
      },
      {
        id: "view-mode",
        targetSelector: '[data-tour="mode-switch"]',
        fallbackSelector: "header .grid, .rita-tile",
        title: {
          en: "Top Mode Switcher: Study View vs Edit & Adjust",
          ar: "مفتاح التبديل العلوي: وضع المذاكرة مقابل وضع التحرير والتنظيم",
        },
        description: {
          en: "Seamlessly separate focused active-recall testing from deck authoring and curriculum management.",
          ar: "فصل تام ومدروس بين مرحلة التركيز والاسترجاع الذهني، وبين مرحلة كتابة وتنظيم محتوى المنهج.",
        },
        bullets: {
          en: [
            "1. RitaJet Brand: Quick return to the home workspace and tools overview.",
            "2. Study View ('Go through your cards'): Minimalist, calm interface engineered to maximize focus and eliminate cognitive clutter during high-intensity revision.",
            "3. Edit & Adjust View ('Build and rearrange your subjects'): Unlocks comprehensive authoring tools to create parent subjects, nest sub-topics, import external Anki/CSV decks, and compose rich-text clinical cards.",
          ],
          ar: [
            "١. شعار RitaJet: للعودة السريعة للواجهة الرئيسية وقائمة الأدوات.",
            "٢. وضع المذاكرة (Study view - الأخضر): واجهة انسيابية هادئة خالية من أي مشتتات لضمان أعلى مستويات التركيز أثناء الحفظ النشط.",
            "٣. وضع التعديل والإضافة (Edit and adjust): يفتح أدوات التحرير المتقدمة لإنشاء المواد، وتفريع المحاضرات، واستيراد ملفات Anki/CSV، وكتابة البطاقات الطبية.",
          ],
        },
        actionPrompt: {
          label: {
            en: "Switch to Edit View to explore authoring tools →",
            ar: "انتقل لوضع التعديل لاستكشاف أدوات الإضافة ←",
          },
          actionId: "toggle-edit-mode",
        },
      },
    ],
  },

  /* =========================================================================
     2. SPACES & CLASSROOMS (/spaces) - In-Depth Collaborative Study
     ========================================================================= */
  spaces: {
    toolKey: "spaces",
    title: { en: "Classrooms, Study Groups & Collaborative Spaces", ar: "الفصول الدراسية، مجموعات المذاكرة والغرف المشتركة" },
    steps: [
      {
        id: "spaces-classrooms",
        targetSelector: '[data-tour="spaces-classrooms"]',
        fallbackSelector: "main section:nth-of-type(2)",
        title: {
          en: "Point 1: Classrooms — Whole-Cohort Academic Spaces",
          ar: "النقطة الأولى: الفصول الدراسية (Classrooms) — مساحات الدفعة الأكاديمية الموحدة",
        },
        description: {
          en: "Built for an entire academic year or university medical batch (e.g. Class of 2027). A classroom acts as the official single source of truth for the curriculum, keeping everyone synchronized on approved decks and exam schedules.",
          ar: "مخصصة لدفعة دراسية كاملة أو سنة أكاديمية كاملة (مثل دفعة الطب 2027). يمثل الفصل الدراسي المرجع الرسمي والموحد للمنهج لضمان دراسة الجميع من نفس البطاقات المعتمدة ومواعيد الاختبارات.",
        },
        bullets: {
          en: [
            "1. Cohort Architecture: One centralized academic hub where class representatives and peer editors curate approved folder trees by block, exam, and clinical specialty.",
            "2. Synchronized Errata & Updates: When lecture notes or clinical guidelines change, errata corrections and additions update across all students in the classroom simultaneously.",
            "3. Curated Deck Folders: Decks are neatly structured into course blocks (e.g., Midterm Block → Pathology → Valvular Heart Disease) preventing study fragmentation.",
            "4. '+ New classroom' Button: Instant creation flow to establish a new official room for your university batch.",
          ],
          ar: [
            "١. بنية متكاملة للدفعة: مساحة أكاديمية مركزية ينظم فيها ممثلو الدفعة والطلاب المتفوقون مجلدات المنهج حسب البلوكات والمقررات والامتحانات.",
            "٢. تصحيحات وتحديثات متزامنة: عند تحديث أي معلومة أو تعديل ملاحظة أستاذ المادة، تُحدّث البطاقات لدى جميع طلاب الصف في نفس اللحظة.",
            "٣. مجلدات منهجية مفهرسة: تقسيم المجموعات وفق خطة الكلية (مثلاً: بلوك النصفي ← الباطنة ← أمراض صمامات القلب) لمنع تشتت الطلاب.",
            "٤. زر إنشاء فصل (+ New classroom): زر سريع لتدشين مساحة رسمية لدفعتك الجامعية فوراً.",
          ],
        },
      },
      {
        id: "spaces-groups",
        targetSelector: '[data-tour="spaces-groups"]',
        fallbackSelector: "main section:nth-of-type(3)",
        title: {
          en: "Point 2: Study Groups — Small Agile Pods for Sprints",
          ar: "النقطة الثانية: مجموعات المذاكرة (Study Groups) — فرق صغيرة وسريعة للتحديات المشتركة",
        },
        description: {
          en: "Designed for small circles (3–8 close classmates, hospital ward rotation teams, or dissection lab partners). Unlike authoritative classrooms, study groups are completely peer-equal where every member can add, refine, and organize decks.",
          ar: "مصممة للدوائر الصغيرة (٣ إلى ٨ زملاء دراسة، أفرقة التدريب السريري في العنابر، أو شركاء مختبرات التشريح). تتميز بحرية كاملة وصلاحيات متساوية لجميع الأعضاء لإضافة وتعديل البطاقات.",
        },
        bullets: {
          en: [
            "1. Peer Pod Collaboration: Perfect for daily study sprints, clinical case discussions, and OSCE preparation where agility is key.",
            "2. Equal Contributor Permissions: Any member in the study group can add new card decks, organize topic branches, and contribute mnemonics.",
            "3. Coordinated Review Challenges: Set synchronized daily targets (e.g. 50 pharmacology cards before ward rounds) to keep every member disciplined.",
            "4. '+ New study group' Button: Launch a private study circle with your study buddies in seconds.",
          ],
          ar: [
            "١. تعاون فريقي مرن: مثالية لتحديات المذاكرة اليومية، ومناقشة الحالات السريرية المعقدة، والتحضير لامتحانات الأوسكي العملية.",
            "٢. صلاحيات مساهمة متكافئة: يحق لكل عضو في المجموعة إضافة مجموعات بطاقات جديدة، وترتيب الفصول، ومشاركة الملاحظات الذكية.",
            "٣. تحديات مراجعة متزامنة: الاتفاق على هدف يومي موحد (مثل مراجعة 50 بطاقة فارما قبل المرور الصباحي) لضمان التزام الفريق.",
            "٤. زر إنشاء مجموعة (+ New study group): أنشئ دائرة دراسية خاصة مع أصدقائك بضغطة زر واحدة.",
          ],
        },
      },
      {
        id: "spaces-join",
        targetSelector: '[data-tour="spaces-join"]',
        fallbackSelector: "main section:first-of-type div:has(input)",
        title: {
          en: "Point 3: Instant Room Access via Private Code & Links",
          ar: "النقطة الثالثة: الانضمام الفوري برمز الدعوة والرابط المباشر",
        },
        description: {
          en: "Seamless, secure onboarding. Enter any 6-character private invite code (e.g. 'abc123') or open a direct join link ('ritajet.app/join/abc123') to gain immediate access to closed classrooms or study groups without manual approval delays.",
          ar: "طريقة انضمام فورية وآمنة تماماً. اكتب رمز الدعوة المكون من 6 خانات (مثل 'abc123') أو افتح رابط الدعوة المباشر ('ritajet.app/join/abc123') للدخول المباشر إلى الفصول المغلقة والمجموعات الخاصة دون انتظار موافقة يدوية.",
        },
        bullets: {
          en: [
            "1. Direct Code Entry: Type or paste the code into the box and click 'Join' to instantly unlock the space.",
            "2. One-Click Web Links: Shareable 'ritajet.app/join/abc123' links automatically authenticate students and navigate them directly into the space.",
            "3. Role & Privacy Security: Owners maintain full control over member lists and editing rights, protecting class notes from unauthorized external access.",
            "4. Personal Shelf Forking: Inside any space, click 'Save to my cards' to copy any deck into your personal library with your own private SM-2 spaced repetition tracking.",
          ],
          ar: [
            "١. إدخال الرمز المباشر: اكتب الرمز أو الصقه في الخانة واضغط 'Join' للانضمام الفوري للصف.",
            "٢. روابط الانضمام السريعة: الروابط المباشرة تتيح لزملائك الانضمام تلقائياً بمجرد تسجيل الدخول بنقرة واحدة.",
            "٣. خصوصية وأمان الصلاحيات: يتحكم مالك الغرفة في قائمة الأعضاء وصلاحيات التعديل لحماية محتوى الدفعة الأكاديمي.",
            "٤. النسخ للمكتبة الشخصية: يمكنك نسخ أي مجموعة من الغرفة إلى مساحتك الدراسية الشخصية ومتابعة تكرارها المتباعد SM-2 باستقلالية تامة.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     3. SHARED FLASHCARDS (/share) - Community Deck Marketplace
     ========================================================================= */
  "shared-decks": {
    toolKey: "shared-decks",
    title: { en: "Community Decks & Open Knowledge Sharing", ar: "الدليل الشامل للبطاقات المشتركة ومكتبة المجتمع" },
    steps: [
      {
        id: "share-card-example",
        targetSelector: '[data-tour="share-deck-card"], [data-tour="share-deck-grid"] > a:first-child',
        fallbackSelector: 'main [data-tour="share-deck-grid"], main',
        title: {
          en: "Point 1: Community Deck Card — Concrete Example ('Cardiology')",
          ar: "النقطة الأولى: بطاقة المجموعة المشتركة — مثال تطبيقي ('Cardiology')",
        },
        description: {
          en: "Inspect high-yield decks published by top students and educators. For example, look at the featured deck 'Sample subject — Cardiology' on your screen:",
          ar: "استعرض مجموعات البطاقات المركزة التي نشرها أوائل الطلاب والأطباء. على سبيل المثال، تأمل بطاقة 'Sample subject — Cardiology' الموضحة على شاشتك:",
        },
        bullets: {
          en: [
            "1. Title & Clinical Scope: 'Sample subject — Cardiology' — covering high-yield ECG interpretations, coronary syndromes, and cardiovascular pharmacology.",
            "2. Type Badge & Card Count: Labeled 'FLASHCARDS' with a count of '10 cards' to immediately communicate format and review time.",
            "3. Subject Tags: Tagged with '#cardiology', '#sample', and '#medicine' for fast cross-specialty indexing and targeted discovery.",
            "4. Creator & Social Proof: Created by verified student '@ritajet', featuring a community rating of '★ 4.9' and '52' active saves across cohorts.",
            "5. One-Click Independent Fork: Click the card to preview questions and save an independent copy to your personal '/study' shelf with your own SM-2 spaced repetition schedule.",
          ],
          ar: [
            "١. العنوان والمحتوى الطبي: 'Sample subject — Cardiology' — يغطي تخطيط القلب ECG، ومتلازمات الشرايين التاجية، وفارماكولوجي القلب المركزة.",
            "٢. شارة النوع وعدد البطاقات: موسومة بعلامة 'FLASHCARDS' مع إجمالي '10 cards' لتعرف فوراً حجم المحتوى والوقت المتوقع لإنهائه.",
            "٣. الوسوم التخصصية: مصنفة بوسوم '#cardiology' و '#medicine' للبحث المتقاطع والتصفية السريعة بين المواد الطبية المختلفة.",
            "٤. صانع المحتوى وثقة المجتمع: من إعداد الطالب '@ritajet'، ومقيّمة بدرجة '★ 4.9' ومحفوظة لدى '52' طالباً من مختلف الجامعات.",
            "٥. النسخ المستقل بنقرة واحدة: اضغط على البطاقة لمعاينتها ونسخها مباشرة إلى رف بطاقاتك في '/study' بجدولة SM-2 خاصة ومستقلة تماماً.",
          ],
        },
      },
      {
        id: "share-filter-modes",
        targetSelector: '[data-tour="share-filters-switcher"]',
        fallbackSelector: 'main input[placeholder*="Search"]',
        title: {
          en: "Point 2: Resource Switcher & Multi-Criteria Filtering Engine",
          ar: "النقطة الثانية: محول الأنماط ومحرك التصفية متعدد المعايير",
        },
        description: {
          en: "Seamlessly discover exactly what you need across clinical flashcards and board questions with zero friction.",
          ar: "اعثر بدقة متناهية على ما تحتاجه من بطاقات استذكار وأسئلة امتحانية سريرية دون أي تعقيد أو إضاعة للوقت.",
        },
        bullets: {
          en: [
            "1. Resource Switcher ('Flashcards' vs 'Questions'): Toggle between spaced repetition flashcards and clinical multiple-choice question sets with a single tap.",
            "2. Live Search Bar: Search across disease names, drug classes, organ systems, lectures, and author usernames instantly.",
            "3. Library Scope ('All decks' vs 'My decks'): Switch between exploring the global student community and managing your own published decks and daily sharing quota.",
            "4. 4-Tier Sorting Engine: Sort by 'Newest' (latest syllabus additions), 'Most saved' (community-vetted favorites), 'Top rated' (highest peer satisfaction), or 'Most cards/questions' (mega-comprehensive sets).",
            "5. Question Source Filter: When exploring questions, filter specifically by Lecture Lab quizzes or Question Bank clinical sets.",
          ],
          ar: [
            "١. محول الأنماط ('Flashcards' مقابل 'Questions'): تنقل بنقرة واحدة بين بطاقات الاستذكار المتباعد وبنوك الأسئلة السريرية متعددة الخيارات.",
            "٢. شريط البحث الفوري: ابحث عن أسماء الأمراض، عائلات الأدوية، عناوين المحاضرات، أو أسماء الزملاء والناشرين فورياً.",
            "٣. نطاق العرض ('All decks' مقابل 'My decks'): التبديل بين تصفح مكتبة المجتمع العالمية وإدارة البطاقات التي شاركتها بنفسك ومتابعة حصتك اليومية.",
            "٤. محرك الترتيب الرباعي: رتّب حسب 'الأحدث' (Newest)، 'الأكثر حفظاً' (Most saved)، 'الأعلى تقييماً' (Top rated)، أو 'الأكثر بطاقات' (Most cards) للمجموعات الشاملة.",
            "٥. تصفية مصادر الأسئلة: عند استعراض الأسئلة، يمكنك التصفية حسب اختبارات مختبر المحاضرات أو بنك الأسئلة السريري.",
          ],
        },
      },
      {
        id: "share-publishing-quota",
        targetSelector: '[data-tour="share-create-btn"]',
        fallbackSelector: 'main a[href*="/share/new"]',
        title: {
          en: "Point 3: Publishing Workflow & Fair-Use Sharing Quota",
          ar: "النقطة الثالثة: خطوات النشر وحصة المشاركة العادلة اليومية",
        },
        description: {
          en: "Contribute high-yield decks to help classmates while retaining full control over privacy and fair-use platform health.",
          ar: "انشر ملخصاتك وبطاقاتك المتميزة لدعم زملائك مع تحكم كامل في مستويات الخصوصية وحماية المحتوى من التكرار العشوائي.",
        },
        bullets: {
          en: [
            "1. '+ Share flashcards' Button: Launch the visual publishing wizard with custom cover gradients, medical emojis, and clinical descriptions.",
            "2. Audience Privacy Levels: Choose between 'Public' (discoverable by all students worldwide) or 'Classroom only' (restricted to your private university study space).",
            "3. Fair-Use Quota (5/day): Each student has 5 sharing slots per day to prevent spam and maintain high academic curation standards across the platform.",
            "4. Instant Slot Restoration: If you reach 5/5 today and need to share a revised deck, simply delete any item you shared today to immediately recover a free upload slot.",
            "5. Zero Risk of Modification: When others save your deck, they receive an independent copy — your original cards and personal study stats remain completely untouched.",
          ],
          ar: [
            "١. زر المشاركة (+ Share flashcards): يفتح معالج النشر السريع لاختيار تدرج الغلاف، الرموز التعبيرية الطبية، وكتابة نبذة سريرية دقيقة.",
            "٢. مستويات الخصوصية المتقدمة: اختر بين 'عام للجميع' (Public) ليظهر لجميع طلاب المنصة، أو 'محصور بالصف' (Classroom only) لطلاب مجموعتك الدراسية المغلقة فقط.",
            "٣. حصة الاستخدام العادل (٥ يومياً): يُتاح لكل طالب مشاركة حتى 5 مجموعات يومياً لمنع الإغراق والحفاظ على أعلى معايير الجودة العلمية.",
            "٤. الاستعادة الفورية للحصة: إذا وصلت للحد الأقصى (5/5) وأردت رفع مجموعة معدلة، احذف أي مجموعة شاركتها اليوم لتستعيد خانة النشر فوراً دون انتظار الغد.",
            "٥. أمان تام وبلا تعديل: عند قيام الزملاء بحفظ مجموعتك، يحصلون على نسخة مستقلة تماماً، ويبقى محتواك الأصلي وإحصائياتك الشخصية محفوظة ومحمية.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     4. QUESTION BANK (/courses/question-bank)
     ========================================================================= */
  "question-bank": {
    toolKey: "question-bank",
    title: { en: "Mastering the Clinical Question Bank", ar: "الدليل الاحترافي لبنك الأسئلة السريرية" },
    steps: [
      {
        id: "qb-topics",
        targetSelector: '[data-tour="qb-topics"]',
        fallbackSelector: 'main section:first-of-type, main',
        title: {
          en: "Clinical Vignettes & Multi-Discipline Targeting",
          ar: "الحالات السريرية وتحديد الفروع والموضوعات",
        },
        description: {
          en: "Select high-yield sub-specialties or composite organ systems. Every question is structured as a realistic patient case vignette with vital signs, physical examination findings, and lab values.",
          ar: "حدد الفروع السريرية الدقيقة أو الأجهزة الحيوية المركبة؛ كل سؤال مصمم كحالة مريض واقعية تضم القصة المرضية، العلامات الحيوية، الفحص السريري، والنتائج المخبرية.",
        },
        bullets: {
          en: [
            "1. Flexible Question Pool: Select from All Questions, Incorrect Attempts (targeted weakness remediation), or Flagged questions.",
            "2. Sub-Subject Granularity: Focus strictly on high-yield targets like Rheumatic Heart Disease, Arrhythmias, or Antimicrobial Therapy.",
            "3. Progress Counts: View exactly how many questions exist and how many you have checked in real time.",
          ],
          ar: [
            "١. بنك أسئلة متدرج: اختر بين دراسة جميع الأسئلة، أو التركيز على إجاباتك الخاطئة السابقة لتصحيح نقاط الضعف، أو مراجعة الأسئلة المميزة بعلامة (Flagged).",
            "٢. دقة التخصيص: ركّز على عناوين محددة كالحمى الروماتيزمية، اضطرابات النظم، أو مضادات الميكروبات.",
            "٣. عدادات الإنجاز: شاهد بالضبط كم سؤالاً يتضمنه كل موضوع وعدد الأسئلة المحددة حالياً في الوقت الفعلي.",
          ],
        },
      },
      {
        id: "qb-mode",
        targetSelector: '[data-tour="qb-modes"]',
        fallbackSelector: "aside",
        title: {
          en: "Tutor Study Mode vs Timed Exam Simulation",
          ar: "وضع الدراسة التعليمي مقابل محاكاة الاختبار التنازلي",
        },
        description: {
          en: "Toggle between learning mode and authentic exam conditioning depending on your revision timeline.",
          ar: "اختر بين وضع الاستيعاب المعرفي التدريجي، وبين وضع الضغط الزمني لتدريب النفس على ظروف الاختبار الحقيقية.",
        },
        bullets: {
          en: [
            "1. Study Mode (Tutor): Ideal for initial revision. Provides immediate verdict, reveals correct mechanisms, and unrolls pedagogical rationale panels.",
            "2. Exam Mode: Real-time countdown timer, locked answers, and hidden explanations to test endurance and pace management.",
            "3. Timing Controls: Set custom durations (15m, 30m, 60m, 90m, 120m) to train your pacing for official board exams.",
          ],
          ar: [
            "١. وضع الدراسة (المعلّم الفوري): مثالي لمرحلة الحفظ والاستيعاب؛ يقدم تصحيحاً فورياً وشرحاً متكاملاً بعد كل خيار.",
            "٢. وضع الامتحان: مؤقت تنازلي حقيقي، وحجب للإجابات والشروحات حتى إنهاء الاختبار لتدريبك على إدارة وقت الامتحان الرسمي.",
            "٣. التحكم في التوقيت: حدد أوقات مخصصة (15د، 30د، 60د، 90د، 120د) لتدريب سرعة الحل للامتحانات الوزارية والنهائية.",
          ],
        },
      },
      {
        id: "qb-explanations",
        targetSelector: '[data-tour="qb-start"]',
        fallbackSelector: 'aside button.magnetic-cta, aside',
        title: {
          en: "Deep Clinical Rationales & Distractor Analysis",
          ar: "التعليلات الطبية المفصلة وتحليل الخيارات الخاطئة",
        },
        description: {
          en: "RitaJet explanations don't just state the right choice — they dissect the diagnostic reasoning, Jones criteria, clinical algorithms, and explain exactly why each distractor is clinically invalid.",
          ar: "شروحات ريتاجت لا تكتفي بذكر الجواب الصحيح، بل تحلل المسار التشخيصي كاملاً، وتوضح معايير التشخيص المعتمدة، وتعلل سبب استبعاد كل خيار خاطئ بدقة متناهية.",
        },
        bullets: {
          en: [
            "1. Three Launch Modes: Choose Study Mode (step-by-step), Session Mode (continuous), or Exam Mode (strict timed test).",
            "2. Distractor Diagnostics: Every option explains why it is correct or why other choices are clinical distractors.",
            "3. Reset Anytime: Clear your selections or reset filters in one tap to start a fresh practice batch.",
          ],
          ar: [
            "١. ثلاثة أنماط للإطلاق: اختر نمط الدراسة (خطوة بخطوة)، نمط الجلسة (مستمر)، أو نمط الامتحان (محاكاة بوقت محدد).",
            "٢. تشريح المشتتات: يوضح كل خيار سبب صحته أو سبب خطأ الخيارات الأخرى طبياً وسريرياً.",
            "٣. إعادة الضبط بسهولة: امسح الاختيارات وأعد ضبط الفلاتر بنقرة واحدة لبدء جلسة جديدة فوراً.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     5. MEMORY LAB (/study/match)
     ========================================================================= */
  "memory-lab": {
    toolKey: "memory-lab",
    title: { en: "Memory Lab & Dual-Coding Retention", ar: "مختبر الذاكرة والربط المعرفي المزدوج" },
    steps: [
      {
        id: "ml-subjects",
        targetSelector: '[data-tour="ml-subjects"]',
        fallbackSelector: "main > div:first-child, .max-h-\\[74vh\\]",
        title: {
          en: "Subject & Topic Hierarchy for Memory Pairs",
          ar: "هيكلة المواد والمحاضرات لأزواج الذاكرة",
        },
        description: {
          en: "Organize volatile, hard-to-memorize facts into high-yield medical subjects and nested sub-topics. Selecting any topic immediately stages its paired items for play.",
          ar: "تنظيم المعلومات سريعة النسيان في مواد رئيسية وفصول فرعية؛ تحديد أي موضوع يجهز أزواجه تلقائياً داخل محرك الألعاب.",
        },
        bullets: {
          en: [
            "1. Subject Modules ('Sample subject — Cardiology'): Represents major clinical domains, tracking total sub-topics and active pairs.",
            "2. Sub-Topic Chapters ('Sample · Myocardial infarction'): Concentrated topic blocks grouping specific disease mechanisms or drug classes.",
            "3. Active Pair Badges ('6 cards / pairs'): Displays the exact volume of memory pairs stored inside each sub-topic.",
            "4. Selection Checkboxes: Click the circular checkbox to select topics; you can combine multiple topics to practice across disciplines.",
            "5. Reorder & Edit Controls: Use the chevron arrows to reorder, pencil icon to rename, and trash icon to delete.",
          ],
          ar: [
            "١. مجلد المادة الكبرى ('Cardiology'): يمثل التخصص الطبي الرئيسي، مع بيان عدد الفصول الفرعية والأزواج المتاحة.",
            "٢. الفصول والمحاضرات الفرعية ('Myocardial infarction'): وحدات مركزة تضم أزواج الأمراض، الأدوية، أو المعايير التشخيصية.",
            "٣. شارات عدد الأزواج ('6 cards / pairs'): توضح عدد الأزواج الجاهزة للعب والمراجعة داخل كل موضوع فرعي.",
            "٤. دوائر التحديد: اضغط على الدائرة لاختيار موضوع أو عدة موضوعات لبدء تدريب الذاكرة عليها فوراً.",
            "٥. الترتيب والإجراءات المباشرة: أسهم لترتيب أولوية المواضيع، وقلم لتعديل الاسم، وسلة لحذف الموضوع عند الحاجة.",
          ],
        },
      },
      {
        id: "ml-rail",
        targetSelector: '[data-tour="study-rail"]',
        fallbackSelector: "aside",
        title: {
          en: "Left Rail: Fast Organization & Pair Creation",
          ar: "شريط الأدوات الجانبي: تنظيم المناهج وبناء الأزواج",
        },
        description: {
          en: "The vertical side rail provides fast, single-click shortcuts to build, organize, and manage your memory modules.",
          ar: "يوفر الشريط الجانبي أدوات فورية لإضافة المواد، وبناء أزواج الذاكرة، وإدارة موضوعاتك بضغطة واحدة.",
        },
        bullets: {
          en: [
            "1. Add subject (New - Apricot): Creates a new primary course or medical specialty (e.g. Pharmacology, Pathology, Microbiology).",
            "2. Add sub-subject (Nest - Sky): Nests a specific lecture, organ system, or diagnostic block inside your chosen subject.",
            "3. Add pairs (Build the facts - Mint): Switches to Edit Mode and opens the two-column Pair Creator to enter left prompt (e.g. drug/disease) and right answer (e.g. mechanism/dose).",
            "4. Remove (Delete - Clay): Safely deletes a selected lecture or subject folder with a confirmation dialog.",
            "5. Edit (Rename - Lilac): Quickly renames subjects or sub-topics to keep your medical taxonomy accurate.",
          ],
          ar: [
            "١. إضافة مادة (Add subject - برتقالي): لإنشاء تخصص طبي رئيسي جديد (مثل علم الأدوية، الأحياء الدقيقة، علم الأمراض).",
            "٢. إضافة مادة فرعية (Add sub-subject - سماوي): لتفريع محاضرة أو فصل دراسي جديد داخل المادة المختارة.",
            "٣. إضافة أزواج (Add pairs - أخضر نعناعي): ينتقل تلقائياً لوضع التحرير ويفتح منشئ الأزواج لكتابة الطرف الأيمن والطرف الأيسر المقابل له.",
            "٤. حذف (Remove - أحمر طيني): لحذف المحاضرة أو المادة المحددة بأمان مع نافذة تأكيد لمنع الحذف العرضي.",
            "٥. تعديل الاسم (Edit - بنفسجي): لتعديل وتحديث أسماء المواد والمحاضرات بسهولة.",
          ],
        },
      },
      {
        id: "ml-modes",
        targetSelector: '[data-tour="ml-modes"]',
        fallbackSelector: "aside:has(button), .lg\\:sticky",
        title: {
          en: "Session Launchpad: 4 Game Modes & Challenge Toggles",
          ar: "لوحة انطلاق الجلسة: 4 أنماط ألعاب ومفاتيح التحدي",
        },
        description: {
          en: "Transform hard-to-memorize facts into reflex memory associations through four scientifically designed associative recall modes.",
          ar: "حوّل المعلومات الطبية سريعة النسيان إلى استجابات فورية وتلقائية عبر 4 أنماط ألعاب علمية ومفاتيح تحدي متقدمة.",
        },
        bullets: {
          en: [
            "1. Audio FX Toggle (Volume icon): Header speaker button to enable or mute sound effects and celebration audio cues.",
            "2. Pair Readiness Counter ('0 pairs ready · Tick a subject or sub-subject'): Live indicator of staged pairs from selected topics.",
            "3. 'Match' Mode (Six on the left, six on the right): Classical associative grid matching; click matching tiles to clear the board at your own pace.",
            "4. 'Speed' Mode (One prompt, four answers, 8 seconds): Rapid-fire drill; tests quick recall under a tight 8-second countdown.",
            "5. 'Recall' Mode (Type the answer from memory): Pure active retrieval; requires typing the exact match from memory without visual clues.",
            "6. 'Sequence' Mode (Drag five tiles into order): Chronological & procedural ordering for clinical pathways and diagnostic steps.",
            "7. 'Sudden death' Toggle: High-stakes precision mode; a single incorrect match immediately ends the game.",
            "8. 'Timed challenge' Toggle: Speed endurance mode; introduces a master countdown timer for the entire session.",
            "9. 'Play' Button: Master green CTA button that launches the fullscreen interactive game once ≥2 pairs are ready.",
          ],
          ar: [
            "١. مفتاح المؤثرات الصوتية (أيقونة الصوت): زر علوي للتحكم في كتم أو تفعيل الأصوات التفاعلية وأصوات الفوز.",
            "٢. عداد جاهزية الأزواج ('0 pairs ready'): يوضح عدد الأزواج الجاهزة للعب بناءً على الموضوع المحدد.",
            "٣. نمط المطابقة (Match - 6 في اليمين و6 في اليسار): الربط الكلاسيكي؛ يعرض عمودين بست بطاقات لتوصيل كل مصطلح بنظيره بهدوء وتركيز.",
            "٤. نمط السرعة (Speed - خيار من 4 خلال 8 ثوانٍ): تدريب مكثف عالي الضغط؛ سؤال و4 خيارات مع مؤقت 8 ثوانٍ لتدريب العقل على الاستجابة اللحظية.",
            "٥. نمط الاسترجاع (Recall - كتابة الإجابة غيباً): الاستدعاء النشط الخالص؛ يظهر المصطلح وعليك كتابة الجواب من الذاكرة لتقوية مسارات الحفظ العميق.",
            "٦. نمط الترتيب (Sequence - سحب 5 بطاقات بالترتيب): الترتيب الإجرائي؛ اسحب 5 خطوات سريرية وضعها في تسلسلها الصحيح.",
            "٧. مفتاح الموت المفاجئ (Sudden death): نمط التحدي الحاسم؛ أي خطأ واحد ينهي الجولة فوراً لتدريب النفس على الدقة المطلقة 100%.",
            "٨. مفتاح التحدي الزمني (Timed challenge): مؤقت تنازلي للجولة لاختبار سرعتك وقدرتك على اتخاذ القرار الطبي تحت ضغط الوقت.",
            "٩. زر بدء اللعب (Play): الزر الأخضر الأساسي الذي يفتح نافذة اللعبة التفاعلية فور تحديد زوجين على الأقل.",
          ],
        },
      },
      {
        id: "ml-mode-switch",
        targetSelector: '[data-tour="mode-switch"]',
        fallbackSelector: "header",
        title: {
          en: "Top Workspace Switcher: Study vs Edit View",
          ar: "مفتاح التبديل العلوي: وضع المذاكرة مقابل وضع التحرير وبناء الأزواج",
        },
        description: {
          en: "Seamlessly switch between playing memory games and authoring new prompt-answer pairs.",
          ar: "تبديل فوري بين بيئة اللعب والاختبار، وبين بيئة تأليف وكتابة أزواج الذاكرة الجديدة.",
        },
        bullets: {
          en: [
            "1. Study View ('Go through your cards'): Clean, focused gaming layout where you pick subjects and play the 4 associative memory modes.",
            "2. Edit and adjust study view ('Build and rearrange your subjects'): Authoring mode unlocking the Pair Creator to write left/right pairs and organize chapters.",
          ],
          ar: [
            "١. وضع المذاكرة (Study view - الأخضر): بيئة لعب مركزة وهادئة مخصصة لاختيار المواضيع وخوض أنماط الذاكرة الأربعة.",
            "٢. وضع التعديل والضبط (Edit and adjust): بيئة التأليف التي تفتح منشئ الأزواج (Pair Creator) لكتابة أطراف البطاقات وتعديلها.",
          ],
        },
        actionPrompt: {
          label: {
            en: "Switch to Edit View to explore Pair Creator →",
            ar: "انتقل لوضع التعديل لاستكشاف منشئ الأزواج ←",
          },
          actionId: "toggle-edit-mode",
        },
      },
    ],
  },

  /* =========================================================================
     6. PDF SUMMARY (/study/pdf)
     ========================================================================= */
  "pdf-summary": {
    toolKey: "pdf-summary",
    title: { en: "High-Yield One-Page PDF Synthesis", ar: "التلخيص المركز للأوراق والمحاضرات الطبية" },
    steps: [
      {
        id: "pdf-synthesis",
        targetSelector: '[data-tour="pdf-dropzone"], main',
        title: {
          en: "Clinical Distillation & High-Yield Pearls",
          ar: "التقطير السريري واستخلاص الدرر الامتحانية",
        },
        description: {
          en: "Upload dense medical lecture PDFs (50-100 slides) and watch Rita AI synthesize them into an elegant, high-yield single sheet highlighting diagnostic triads, pathognomonic signs, and key clinical pearls.",
          ar: "ارفع عروض المحاضرات الطبية الكثيفة (50 إلى 100 شريحة)، ودع ريتا تستخلص منها زبدة المنهج في ورقة واحدة منظمة تبرز الثلاثيات التشخيصية، والعلامات الفارقة، والنقاط الامتحانية الحاسمة.",
        },
      },
    ],
  },

  /* =========================================================================
     7. TO-DO LIST (/study/todo)
     ========================================================================= */
  todo: {
    toolKey: "todo",
    title: { en: "Systematic Study Planning & Streaks", ar: "مخطط المذاكرة المنظم وسلاسل الالتزام" },
    steps: [
      {
        id: "todo-nav",
        targetSelector: '[data-tour="todo-nav"]',
        fallbackSelector: "aside",
        title: {
          en: "Planner Navigation, Dates & Project Folders",
          ar: "شريط التنقل، المواعيد ومجلدات المشاريع",
        },
        description: {
          en: "Your central navigation column to manage task flow across time horizons and clinical subjects.",
          ar: "شريط التنقل المحوري لإدارة مهامك وجدولك الدراسي عبر مختلف الفترات الزمنية والمشاريع الأكاديمية.",
        },
        bullets: {
          en: [
            "1. Search Bar ('Search  /'): Fast search filter to find any task or lecture note instantly (press '/' anytime).",
            "2. 'Inbox': The capture station for unscheduled tasks and quick study ideas that have not been assigned a specific date.",
            "3. 'Today' (with Live Badge): Shows all tasks due today or overdue, with a live numeric counter to keep you focused on today's quota.",
            "4. 'Upcoming' (with Live Badge): Chronological forward-looking planner organizing tasks day by day across the upcoming week.",
            "5. Projects & '+ New project': Create dedicated color-coded project lists (e.g. Finals Week, Internal Medicine, Surgery Rotation) to group related tasks.",
            "6. Labels ('#tags'): Contextual tags to group tasks across multiple projects (e.g. #high-yield, #dr-notes, #urgent).",
          ],
          ar: [
            "١. شريط البحث الفوري ('Search  /'): بحث سريع للعثور على أي مهمة أو ملاحظة بمجرد كتابة أول حروف (أو الضغط على '/') في أي وقت.",
            "٢. صندوق الوارد (Inbox): محطة استقبال الأفكار والمهام غير المجدولة لتدوينها فوراً قبل تعيين موعد محدد لها.",
            "٣. اليوم (Today مع عداد حي): يعرض جميع المهام المستحقة اليوم مع عداد رقمي يوضح ما تبقى لإنجازه اليوم.",
            "٤. القادم (Upcoming مع عداد حي): المخطط الزمني المستقبلي الذي يرتب مهامك يوماً بيوم خلال الأسبوع والشهر القادمين.",
            "٥. المشاريع (+ New project): إنشاء مجلدات مخصصة وملونة لكل مادة أو امتحان (مثل: اختبار النصفي، باطنة، جراحة).",
            "٦. التصنيفات (#Labels): وسوم لتصنيف المهام عبر المشاريع المختلفة (مثل: #مهم_جداً، #ملاحظات_الدكتور).",
          ],
        },
      },
      {
        id: "todo-tasks",
        targetSelector: '[data-tour="todo-tasks"]',
        fallbackSelector: "main",
        title: {
          en: "Task Workspace, Scheduling & Overdue Control",
          ar: "لوحة المهام، الجدولة والتحكم في المهام المتأخرة",
        },
        description: {
          en: "The oversized calm board where you track daily study quotas, manage deadlines, and build compounding study streaks.",
          ar: "اللوحة الرئيسية الهادئة والواضحة لمتابعة حصتك الدراسية اليومية، وإدارة مواعيد التسليم، وبناء سلاسل الإنجاز.",
        },
        bullets: {
          en: [
            "1. View Title & Pending Counter ('Upcoming · 1 task left'): Header displaying the active time view and count of remaining open tasks.",
            "2. 'Hide / Show completed' Toggle: Instantly declutter your board by hiding finished tasks, or reveal them to celebrate completed work.",
            "3. Overdue Notice & 'Reschedule': Warns you of lapsed tasks from past days, with a one-click 'Move all to today' button.",
            "4. Task Item Row: Checkbox circle to mark done, title, drag handle to reorder, sub-tasks indicator, and edit pencil.",
            "5. Day-by-Day Buckets ('Today · Sunday', 'Tomorrow · Monday'): Visual separation of tasks by calendar date.",
            "6. Inline '+ Add task': Click on any specific day header to add a task pre-scheduled directly for that date.",
            "7. Quick Add Shortcut (Key 'Q'): Press 'Q' anywhere on the page to immediately open the smart natural-language task composer.",
          ],
          ar: [
            "١. عنوان العرض وعداد المهام المتبقية ('Upcoming · 1 task left'): يوضح اسم العرض الحالي وعدد المهام التي تنتظر إنجازها.",
            "٢. زر إخفاء / إظهار المكتمل: تنظيف الشاشة بإخفاء المهام المنجزة، أو إظهارها للاطلاع على ما حققته اليوم.",
            "٣. قسم المتأخرات (Overdue) وزر إعادة الجدولة: يبرز المهام المتأخرة من الأيام السابقة مع زر بضغطة واحدة لنقلها إلى اليوم.",
            "٤. بطاقة المهمة: دائرة للإنجاز، عنوان المهمة، مقبض سحب لإعادة الترتيب، مؤشر المهام الفرعية، وقلم التعديل.",
            "٥. أقسام الأيام (اليوم، غداً، الأيام القادمة): توزيع بصري مريح للمهام حسب تواريخ التقويم.",
            "٦. إضافة مهمة مباشرة (+ Add task): زر في كل يوم لإضافة مهمة مجدولة في ذلك اليوم تحديداً.",
            "٧. اختصار الإضافة السريع (مفتاح Q): اضغط حرف Q في أي مكان لفتح نافذة إضافة المهام الذكية فوراً.",
          ],
        },
      },
      {
        id: "todo-header",
        targetSelector: '[data-tour="todo-header"]',
        fallbackSelector: "header, .border-b",
        title: {
          en: "Keep the Day Light: RitaJet Philosophy",
          ar: "اجعل يومك خفيفاً: فلسفة ريتاجت في تنظيم المذاكرة",
        },
        description: {
          en: "RitaJet's to-do planner is built on cognitive pacing: set realistic daily targets (3-5 high-yield tasks) to prevent burnout and maintain long-term momentum.",
          ar: "مخطط مهام ريتاجت مبني على التوازن الذهني؛ حدد أهدافاً واقعية ومركزة (3 إلى 5 مهام نوعية يومياً) لمنع الإرهاق والحفاظ على الاستمرارية الطويلة.",
        },
        bullets: {
          en: [
            "1. Daily Goal Calibration: Avoid overloading your daily list; focus on completing your primary study targets first.",
            "2. 'All study tools' Shortcut: Seamlessly navigate back to flashcards, question banks, or memory labs once your daily study plan is set.",
          ],
          ar: [
            "١. ضبط الأهداف اليومية: تجنب تكديس المهام غير الواقعية؛ ركّز على إتمام أولوياتك الأكاديمية الكبرى أولاً.",
            "٢. زر 'جميع أدوات الدراسة': انتقال فوري بضغطة واحدة إلى البطاقات، بنك الأسئلة، أو مختبر الذاكرة فور تنظيم جدول يومك.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     8. EXAMS (/study/exams)
     ========================================================================= */
  exams: {
    toolKey: "exams",
    title: { en: "Academic Exam Calendar & Countdown Matrix", ar: "تقويم الامتحانات الأكاديمية ومصفوفة العد التنازلي" },
    steps: [
      {
        id: "exams-calendar",
        targetSelector: '[data-tour="exams-calendar"], [data-tour="exams-container"]',
        fallbackSelector: "main",
        title: {
          en: "Academic Exam Calendar & Countdown Matrix",
          ar: "تقويم الامتحانات الأكاديمية ومصفوفة العد التنازلي",
        },
        description: {
          en: "Plan and visualize every upcoming final, midterm, OSPE/OSCE clinical exam, and quiz on a unified interactive monthly grid, keeping your revision pacing synchronized with your exam deadlines.",
          ar: "خطط وتتبع جميع اختباراتك النهائية، النصفية، واختبارات الأوسكي السريرية على تقويم شهري تفاعلي موحد، للحفاظ على وتيرة مراجعة منضبطة ومتزامنة مع مواعيد اختباراتك.",
        },
        bullets: {
          en: [
            "1. Month-by-Month Horizon (< September 2026 >): Navigate forward or backward across terms and semesters, or tap 'Today' to return instantly to the current day.",
            "2. '+ Add new exam' Button: Register an exam in seconds by specifying the course name and target date — it immediately populates onto the calendar.",
            "3. 7-Day Weekly Grid (Monday to Sunday): View the entire month at a glance with clear day numbers, distinguished previous/next month days, and an emerald green badge marking today.",
            "4. Exam Badges & Fast Deletion: Scheduled exams display with a graduation cap badge directly on their day; hover over any exam to remove or edit it when dates shift.",
            "5. Private & Account-Synced: All exam dates are securely private to your account and automatically integrate into your study reminders and spaced repetition priorities.",
          ],
          ar: [
            "١. التنقل الشهري (< سبتمبر 2026 >): تنقل بسهولة بين الشهور والفصول الدراسية، أو اضغط زر 'Today' للعودة فوراً لليوم الحالي.",
            "٢. زر '+ Add new exam': أضف أي اختبار خلال ثوانٍ بتحديد اسم المادة وتاريخ الامتحان ليظهر مباشرة على التقويم.",
            "٣. شبكة الأيام الأسبوعية (من الإثنين إلى الأحد): تصفح الشهر كاملاً بوضوح مع تمييز أيام الشهر الماضي والقادم، ورمز أخضر زمردي يحدد اليوم الحالي.",
            "٤. بطاقات الاختبارات وسهولة الحذف: تظهر الامتحانات المجدولة برمز قبعة التخرج في يومها المحدد؛ مرر الفأرة فوق أي امتحان لحذفه فوراً عند تعديل المواعيد.",
            "٥. مزامنة آمنة وخاصة بحسابك: جميع مواعيد الاختبارات محفوظة بأمان في حسابك وتتكامل مع أولويات جدول المذاكرة والتكرار المتباعد.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     9. ALL-IN-ONE (/study/all-in-one) - Multi-Pass AI Studio
     ========================================================================= */
  "all-in-one": {
    toolKey: "all-in-one",
    title: { en: "All-in-One Multi-Pass AI Studio", ar: "استوديو ريتا الشامل متعدد المعالجة" },
    steps: [
      {
        id: "aio-studio-input",
        targetSelector: '[data-tour="aio-studio-box"]',
        fallbackSelector: "main section:first-of-type",
        title: {
          en: "Point 1: One Upload · Complete Academic Package",
          ar: "النقطة الأولى: رفع واحد · حزمة أكاديمية متكاملة بضغطة واحدة",
        },
        description: {
          en: "Drop a lecture PDF (digital slides or physical document scans) or paste raw text. In one single background pass, Rita AI extracts and generates your complete 4-part study package.",
          ar: "ارفع ملف المحاضرة PDF (سواء شرائح إلكترونية أو مسح ضوئي بالأوراق) أو الصق النص مباشرة. وبضغطة زر واحدة في الخلفية، تُولّد لك ريتا حزمة دراسية متكاملة من 4 أقسام.",
        },
        bullets: {
          en: [
            "1. Flexible Input (PDF or Text): Switch between 'PDF' for documents and book chapters or 'Paste text' for lecture transcripts.",
            "2. 4 Automated Deliverables: Automatically builds a structured Study Guide, a 1-page Summary Sheet, 16 Spaced Repetition Flashcards, and 15 Clinical Practice Questions.",
            "3. 'Build everything' Action: Initiates AI processing. You can safely close the tab — processing continues asynchronously in the cloud.",
            "4. Plan Upgrade Protection: If you don't have an active plan or run out of quota, dropping a PDF will prompt you to upgrade without losing any previous work.",
          ],
          ar: [
            "١. خيارات إدخال مرنة (PDF أو نص): اختر 'PDF' لرفع ملفات المحاضرات والكتب أو 'Paste text' للصق تفريغ المحاضرات.",
            "٢. ٤ مخرجات أكاديمية شاملة: توليد تلقائي لدليل دراسي مفصل، وورقة ملخص مركزة، و16 بطاقة فلاش كارد، وبنك يحتوي على 15 سؤالاً تدريبياً.",
            "٣. زر 'Build everything': يطلق المعالجة الذكية في الخلفية بأمان؛ يمكنك إغلاق المتصفح والعودة في أي وقت لتجد كل شيء جاهزاً.",
            "٤. حماية الترقية: إذا لم تكن مشتركاً في باقة مدفوعة، ستظهر لك نافذة الترقية فور محاولة رفع الملف مع الحفاظ على كل بياناتك.",
          ],
        },
      },
      {
        id: "aio-sample-observe",
        targetSelector: '[data-tour="aio-sample-card"]',
        fallbackSelector: "main section:last-of-type a:first-child",
        title: {
          en: "Point 2: Observe the Tuberculosis Handbook Live Example",
          ar: "النقطة الثانية: معاينة مثال 'Tuberculosis Handbook' النموذجي",
        },
        description: {
          en: "Explore a fully generated, real-world All-in-One lecture before spending any plan credits or upgrading. Tap the Tuberculosis Handbook sample below to observe how all 4 tools work together.",
          ar: "عاين مثالاً حقيقياً ومكتملاً لمحاضرة مُعالجة بالذكاء الاصطناعي دون استهلاك أي رصيد من باقتك. اضغط على بطاقة 'Tuberculosis Handbook' لاستكشاف تناغم الأدوات الأربع معاً.",
        },
        bullets: {
          en: [
            "1. Universal Example for All Members: Provided free to every student to observe the quality of the AI study guide, flashcards, and exam questions.",
            "2. Explore the Study Guide & Summary: Review high-yield clinical notes on Mycobacterium tuberculosis, diagnostics, and multi-drug regimens.",
            "3. Interactive Retrieval Practice: Flip through the 16 generated cards and launch the 15-question quiz runner directly inside the workspace.",
            "4. Upgrade to Generate Yours: Once you've inspected the example, upgrade your plan to drop your own curriculum lectures and exams.",
          ],
          ar: [
            "١. مثال نموذجي متاح لجميع الأعضاء: متاح مجاناً لكل طالب لمعاينة الدقة العالية للدليل الدراسي والبطاقات والأسئلة التدريبية.",
            "٢. تصفح الدليل والملخص: استكشف الشرح السريري لمرض السل الرئوي، وطرق التشخيص، والبروتوكولات العلاجية المعتمدة.",
            "٣. تدريب تفاعلي واسترجاع نشط: جرّب مراجعة الـ 16 بطاقة فلاش كارد وأجب عن الـ 15 سؤالاً سريرياً داخل مساحة المحاضرة مباشرة.",
            "٤. الترقية لرفع محاضراتك: بعد معاينة المثال النموذجي، يمكنك ترقية باقتك لرفع محاضرات كليتك وبناء حزمك الأكاديمية الخاصة.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     10. LECTURE LAB (/study/lectures)
     ========================================================================= */
  "lecture-lab": {
    toolKey: "lecture-lab",
    title: { en: "Synchronized Lecture Checkpoints", ar: "مختبر المحاضرات والاختبارات المتزامنة" },
    steps: [
      {
        id: "lecture-interactive",
        targetSelector: '[data-tour="lecture-main"], main',
        title: {
          en: "Active Retrieval During Lecture Playback",
          ar: "الاسترجاع النشط المتزامن مع وقت الشرح",
        },
        description: {
          en: "Generate checkpoint quizzes anchored to exact timestamps in lecture audio or slides to transform passive listening into active cognitive retention.",
          ar: "توليد أسئلة ونقاط فحص مرتبطة بالدقيقة والثانية من وقت شرح المحاضرة، لتحويل الاستماع السلبي إلى تركيز واستيعاب تفاعلي مستمر.",
        },
      },
    ],
  },

  /* =========================================================================
     11. GERMAN LAB (/german)
     ========================================================================= */
  "german-lab": {
    toolKey: "german-lab",
    title: { en: "German Medical & Vocabulary Mastery", ar: "الدليل الشامل لمختبر اللغة الألمانية" },
    steps: [
      {
        id: "german-hero",
        targetSelector: '[data-tour="german-hero"]',
        fallbackSelector: 'main > div:first-of-type, main',
        title: {
          en: "Box 1: The Core Framework — Stop Guessing der, die, das",
          ar: "المربع الأول: الإطار المنهجي — إنهاء تخمين أدوات التعريف der, die, das",
        },
        description: {
          en: "German articles are the foundation of grammar, case declensions (Nominativ, Akkusativ, Dativ, Genitiv), and clinical precision. RitaJet replaces arbitrary memorization with an instinctive, visual, and audio-backed retention loop.",
          ar: "أدوات التعريف الألمانية هي حجر الأساس في القواعد، والإعراب (Nominativ, Akkusativ, Dativ, Genitiv)، والدقة الطبية. يستبدل ريتاجت الحفظ العشوائي بنظام بصري وصوتي يرسخ الأداة في الذاكرة فوراً.",
        },
        bullets: {
          en: [
            "1. Tri-Color Cognitive Anchors: Blue for masculine (der), red for feminine (die), and green for neutral (das) burn gender instinctively into memory without conscious translation.",
            "2. Hierarchical Syllabus Categorization: Sort medical terminology, clinical phrases, and everyday words into structured subjects and sub-subjects.",
            "3. Red-Flag Spaced Reinforcement: Any challenging noun or irregular plural you flag automatically recurs in future sessions until full fluency is achieved.",
            "4. Dual Audio Grounding: Listen to native German voices at both normal conversational speed and slow articulation to master pronunciation subtleties.",
          ],
          ar: [
            "١. التثبيت البصري ثلاثي الألوان: الأزرق للمذكر (der)، الأحمر للمؤنث (die)، والأخضر للمحايد (das) لترسيخ جنس الكلمة في الذاكرة الصورية تلقائياً.",
            "٢. التصنيف الهيكلي للمنهج: قسّم المصطلحات الطبية، العبارات السريرية، ومفردات الحياة اليومية إلى مواد وموضوعات فرعية منظمة.",
            "٣. نظام الراية الحمراء (Red-Flag): الكلمات الصعبة والجموع الشاذة التي تميزها بالراية الحمراء تتكرر بذكاء في الجلسات القادمة حتى تتقنها تماماً.",
            "٤. الاستماع الصوتي المزدوج: استمع لأصوات متحدثين ألمان أصليين بالسرعة الطبيعية أو بالسرعة البطيئة لضبط مخارج الحروف الألمانية بدقة.",
          ],
        },
      },
      {
        id: "german-modes",
        targetSelector: '[data-tour="german-modes"]',
        fallbackSelector: 'main .grid:last-of-type, main',
        title: {
          en: "Box 2: Specialized Training Labs — 4 Modes, 1 Data Source",
          ar: "المربع الثاني: مختبرات التدريب التخصصية — ٤ أنماط من مصدر واحد",
        },
        description: {
          en: "Four specialized practice modules designed to build complete language competence. Enter your vocabulary once, and each lab targets a distinct cognitive pathway.",
          ar: "أربعة أنماط تدريب متخصصة لبناء كفاءة لغوية متكاملة؛ تسجل الكلمة لمرة واحدة فقط، وكل نمط يستهدف مساراً إدراكياً مختلفاً في الدماغ.",
        },
        bullets: {
          en: [
            "1. Article Lab (der · die · das): Rapid tap mode, beat-the-clock speed drills, and an intelligent grammar endings coach that explains why a word takes der, die, or das (e.g., -ung, -heit, -keit, -tion, -ment).",
            "2. Pronunciation Lab (Speak & Score): Listen to authentic native German, record your pronunciation via microphone, and receive real-time 0–100 phonetic scoring with word-by-word color feedback (green/amber/red).",
            "3. Build Lab (Order the Pieces): Reassemble clinical phrases word-by-word and complex compound words syllable-by-syllable, accompanied by instant audio pronunciation on correct assembly.",
            "4. One Place (Add Once, Play Everywhere): Enter a medical word or sentence once, assign it to a chapter, and it automatically populates Article Lab, Pronunciation Lab, Build Lab, and your personal flashcards.",
          ],
          ar: [
            "١. مختبر أدوات التعريف (Article Lab): ألعاب الضغط السريع، وتحدي الوقت، ومعلّم نهايات الكلمات الذكي الذي يشرح لك القاعدة وراء الأداة (مثل: ung-، heit-، keit-، tion-، ment-).",
            "٢. مختبر النطق (Pronunciation Lab): استمع لنطق أصلي، وسجّل صوتك بالميكروفون، واحصل على تقييم فوري من 0 إلى 100 بنظام ألوان كلمة بكلمة (أخضر، برتقالي، أحمر).",
            "٣. مختبر التركيب (Build Lab): أعد تركيب الجمل والعبارات الطبية كلمة بكلمة، والكلمات المركبة مقطعاً بمقطع، مع تشغيل الصوت فور الإجابة الصحيحة.",
            "٤. مكان واحد (One Place): اكتب الكلمة أو الجملة مرة واحدة مع معناها ومادتها، وستظهر تلقائياً في لعبة الأدوات، واختبار النطق، ومختبر التركيب، والبطاقات.",
          ],
        },
      },
    ],
  },
};

export function getTourForTool(toolKey?: string): PageTourDef {
  if (toolKey && TOURS[toolKey]) {
    return TOURS[toolKey]!;
  }
  return TOURS.flashcards!;
}
