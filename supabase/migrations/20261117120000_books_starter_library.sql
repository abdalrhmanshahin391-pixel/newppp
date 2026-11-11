-- Library: a starter shelf of 20 well-known books (a balanced mix: strategy and wisdom, classic
-- novels, mystery, gothic and horror, adventure and science fiction, fantasy).
--
-- Source of every text: Standard Ebooks (standardebooks.org), whose editions are in the public
-- domain; their covers are adapted from public-domain paintings. The covers are files of the site
-- itself (public/book-covers/<slug>.webp), so `cover_path` holds the address "/book-covers/<slug>.webp"
-- (the page serves an address that starts with "/" as it is, not from the covers bucket).
-- The descriptions are written for Uzyra.
--
-- The 19 books with a public-domain text are added published, and marked as rights-checked. Their
-- PDFs are not here: the admin adds each file from the book's page («ارفع ملف الكتاب»).
-- «The Book of Five Rings» is added as a DRAFT without the rights check: the English translations
-- in circulation are protected, so it stays hidden from readers until the admin uploads a file
-- they have the right to use and ticks the rights check.
--
-- Safe to run again: a book that is already there (same import key, or the same title and author)
-- is left as it is, and a category is reused when its Arabic or English name exists. Needs the
-- library updates (status, import key) from before. Nothing runs on a timer.

do $starter$
declare
  v_cats  jsonb := $json$[
  {
    "key": "wisdom",
    "name_ar": "حكمة واستراتيجية",
    "name_en": "Wisdom & Strategy",
    "color": "indigo",
    "icon": "brain"
  },
  {
    "key": "classics",
    "name_ar": "روايات كلاسيكية",
    "name_en": "Classic Novels",
    "color": "rose",
    "icon": "heart"
  },
  {
    "key": "mystery",
    "name_ar": "غموض وتحقيق",
    "name_en": "Mystery & Detective",
    "color": "teal",
    "icon": "search"
  },
  {
    "key": "gothic",
    "name_ar": "رعب وقوطي",
    "name_en": "Gothic & Horror",
    "color": "violet",
    "icon": "feather"
  },
  {
    "key": "adventure",
    "name_ar": "مغامرات وخيال علمي",
    "name_en": "Adventure & Sci-Fi",
    "color": "amber",
    "icon": "rocket"
  },
  {
    "key": "fantasy",
    "name_ar": "خيال وحكايات",
    "name_en": "Fantasy & Fairy Tales",
    "color": "sky",
    "icon": "globe"
  }
]$json$::jsonb;
  v_books jsonb := $json$[
  {
    "slug": "the-art-of-war",
    "title": "The Art of War",
    "alt_title": "فن الحرب · 孫子兵法",
    "author": "Sun Tzu",
    "year": null,
    "pages": 203,
    "level": "C1",
    "category": "wisdom",
    "status": "published",
    "description": "أقدم وأشهر كتاب بالاستراتيجية، كتبه القائد الصيني صن تزو قبل أكثر من 2400 سنة. ثلاثة عشر فصل قصير عن التخطيط وفهم الخصم، ومتى تقاتل ومتى تتجنب القتال. وأفكاره لهلأ بيستفيدوا منها بالإدارة والرياضة والأعمال. ترجمة ليونيل جايلز (1910) مع شروحه.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/the-art-of-war.webp"
  },
  {
    "slug": "meditations",
    "title": "Meditations",
    "alt_title": "التأملات · Ta eis heauton",
    "author": "Marcus Aurelius",
    "year": null,
    "pages": 115,
    "level": "C1",
    "category": "wisdom",
    "status": "published",
    "description": "دفتر خاص كتبه الإمبراطور الروماني ماركوس أوريليوس لنفسه وهو بالحملات العسكرية، وما فكّر ينشره. فيه تذكيرات قصيرة عن الصبر وضبط الأعصاب وتقبّل اللي ما بنقدر نغيّره، وهو من أهم كتب الفلسفة الرواقية. ترجمة جورج لونغ (1862).\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/meditations.webp"
  },
  {
    "slug": "the-book-of-five-rings",
    "title": "The Book of Five Rings",
    "alt_title": "كتاب الحلقات الخمس · 五輪書 · Go Rin No Sho",
    "author": "Miyamoto Musashi",
    "year": 1645,
    "pages": null,
    "level": "C1",
    "category": "wisdom",
    "status": "draft",
    "description": "كتبه الساموراي الياباني ميياموتو موساشي سنة 1645 بآخر أيامه، بعد عشرات المبارزات اللي ما خسر فيها. خمسة فصول: الأرض والماء والنار والريح والفراغ، عن الانضباط والتوقيت وصفاء الذهن بالمعركة وبالحياة.",
    "cover_path": "/book-covers/the-book-of-five-rings.webp"
  },
  {
    "slug": "the-prince",
    "title": "The Prince",
    "alt_title": "الأمير · Il Principe",
    "author": "Niccolò Machiavelli",
    "year": 1532,
    "pages": 87,
    "level": "C1",
    "category": "wisdom",
    "status": "published",
    "description": "كتاب صغير كتبه نيكولو مكيافيلي سنة 1513 كنصيحة لحاكم بدّه يكسب الحكم ويحافظ عليه. صريح لدرجة مقلقة: الأفضل أن يُحَبّ الحاكم أو يُخاف؟ ومنه إجت كلمة «مكيافيلي». من أكثر كتب السياسة قراءة وجدلاً. ترجمة و. ك. مارّيوت (1908).\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/the-prince.webp"
  },
  {
    "slug": "tao-te-ching",
    "title": "Tao Te Ching",
    "alt_title": "داو دي جينغ · 道德經",
    "author": "Laozi",
    "year": null,
    "pages": 108,
    "level": "C1",
    "category": "wisdom",
    "status": "published",
    "description": "81 قصيدة قصيرة منسوبة للحكيم الصيني لاوزي، وهي أساس الفكر الطاوي. بتحكي عن البساطة وترك التكلّف، وإن اللين بيغلب القوة بالنهاية. نص قصير، بس بدّه قراءة بطيئة وتأمل. ترجمة جيمس ليغ (1891).\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/tao-te-ching.webp"
  },
  {
    "slug": "autobiography-of-benjamin-franklin",
    "title": "The Autobiography of Benjamin Franklin",
    "alt_title": "السيرة الذاتية لبنجامين فرانكلين",
    "author": "Benjamin Franklin",
    "year": 1791,
    "pages": 154,
    "level": "B2",
    "category": "wisdom",
    "status": "published",
    "description": "قصة صعود بنجامين فرانكلين: من ابن صانع شموع فقير لعالم ودبلوماسي وواحد من مؤسسي أمريكا. بيحكي عن عاداته وجدول فضائله الثلاثة عشر وكيف طوّر حاله خطوة خطوة. سيرة ذاتية بإنجليزي واضح نسبياً.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/autobiography-of-benjamin-franklin.webp"
  },
  {
    "slug": "pride-and-prejudice",
    "title": "Pride and Prejudice",
    "alt_title": "كبرياء وتحامل",
    "author": "Jane Austen",
    "year": 1813,
    "pages": 299,
    "level": "C1",
    "category": "classics",
    "status": "published",
    "description": "إليزابيث بينيت ذكية وسريعة الرد، ومستر دارسي ثري ومتكبّر. حب بيبدأ بسوء فهم وأحكام مسبقة، ومعه سخرية ذكية من الطبقات والزواج بالمجتمع الإنجليزي. رواية جاين أوستن (1813) من أحب الروايات الرومانسية بالتاريخ.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/pride-and-prejudice.webp"
  },
  {
    "slug": "jane-eyre",
    "title": "Jane Eyre",
    "alt_title": "جين إير",
    "author": "Charlotte Brontë",
    "year": 1847,
    "pages": 471,
    "level": "C1",
    "category": "classics",
    "status": "published",
    "description": "جين إير يتيمة فقيرة بدون سند، بتصير معلّمة وبتحب السيد روتشستر صاحب البيت الغامض. رواية شارلوت برونتي (1847) عن الكرامة والاستقلال، وإنك ما تتنازل عن نفسك حتى لو كان الثمن غالي. فيها أسرار وغرفة مقفولة وضحكة غريبة بالليل.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/jane-eyre.webp"
  },
  {
    "slug": "the-great-gatsby",
    "title": "The Great Gatsby",
    "alt_title": "غاتسبي العظيم",
    "author": "F. Scott Fitzgerald",
    "year": 1925,
    "pages": 147,
    "level": "B2",
    "category": "classics",
    "status": "published",
    "description": "نيويورك بالعشرينات: حفلات ضخمة كل ليلة عند الثري الغامض جاي غاتسبي، وكلها لهدف واحد: يلفت نظر حبيبته القديمة. رواية قصيرة (1925) عن الحلم الأمريكي والمال والحنين، ومن أعظم الروايات الأمريكية.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/the-great-gatsby.webp"
  },
  {
    "slug": "a-christmas-carol",
    "title": "A Christmas Carol",
    "alt_title": "ترنيمة عيد الميلاد",
    "author": "Charles Dickens",
    "year": 1843,
    "pages": 80,
    "level": "B2",
    "category": "classics",
    "status": "published",
    "description": "إبنيزر سكروج رجل بخيل وبارد. ليلة الميلاد بتزوره أشباح الماضي والحاضر والمستقبل لتريه شو صار بحياته. حكاية تشارلز ديكنز (1843) القصيرة عن الكرم والتسامح وفرصة ثانية، وأشهر قصة ميلادية بالأدب الإنجليزي.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/a-christmas-carol.webp"
  },
  {
    "slug": "the-adventures-of-sherlock-holmes",
    "title": "The Adventures of Sherlock Holmes",
    "alt_title": "مغامرات شيرلوك هولمز",
    "author": "Arthur Conan Doyle",
    "year": 1892,
    "pages": 270,
    "level": "B2",
    "category": "mystery",
    "status": "published",
    "description": "اثنتا عشرة قضية قصيرة من لندن الفيكتورية، بيحلّها المحقق شيرلوك هولمز بالملاحظة والاستنتاج، وبيرويها صديقه الدكتور واتسون. كل قصة مستقلة وبتنقرأ بجلسة وحدة، فبتناسب أي حدا بدّه يبلّش بقراءة الإنجليزي.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/the-adventures-of-sherlock-holmes.webp"
  },
  {
    "slug": "the-hound-of-the-baskervilles",
    "title": "The Hound of the Baskervilles",
    "alt_title": "كلب آل باسكرفيل",
    "author": "Arthur Conan Doyle",
    "year": 1902,
    "pages": 164,
    "level": "B2",
    "category": "mystery",
    "status": "published",
    "description": "عائلة باسكرفيل مطاردة بلعنة قديمة: كلب شبحي عملاق بيظهر بالمستنقعات. بيطلبوا من هولمز وواتسون يحققوا بموت السير تشارلز الغامض. أشهر رواية لهولمز (1902)، مليانة جو مرعب وتشويق.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/the-hound-of-the-baskervilles.webp"
  },
  {
    "slug": "dracula",
    "title": "Dracula",
    "alt_title": "دراكولا",
    "author": "Bram Stoker",
    "year": 1897,
    "pages": 458,
    "level": "C1",
    "category": "gothic",
    "status": "published",
    "description": "محامي إنجليزي بيسافر لقلعة بترانسيلفانيا ليعقد صفقة مع الكونت دراكولا، وبيكتشف إن مضيفه مش بشر. رواية (1897) مكتوبة على شكل رسائل ومذكرات، وهي أساس قصص مصاصي الدماء الحديثة.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/dracula.webp"
  },
  {
    "slug": "frankenstein",
    "title": "Frankenstein",
    "alt_title": "فرانكنشتاين",
    "author": "Mary Shelley",
    "year": 1818,
    "pages": 180,
    "level": "C1",
    "category": "gothic",
    "status": "published",
    "description": "عالم شاب اسمه فيكتور فرانكنشتاين بيصنع مخلوق حي من أجزاء جثث، وبعدين بيهرب من مسؤوليته. بدأت ماري شيلي كتابتها وعمرها 18 سنة، وبتطرح لهلأ أسئلة مهمة عن العلم والمسؤولية والوحدة (1818).\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/frankenstein.webp"
  },
  {
    "slug": "the-picture-of-dorian-gray",
    "title": "The Picture of Dorian Gray",
    "alt_title": "صورة دوريان غراي",
    "author": "Oscar Wilde",
    "year": 1890,
    "pages": 194,
    "level": "C1",
    "category": "gothic",
    "status": "published",
    "description": "شاب جميل اسمه دوريان بيتمنى إن لوحته هي اللي تكبر وتشيخ بدل منه. بتتحقق أمنيته: بينغمس باللذة بدون ما يدفع الثمن، واللوحة المخبّأة بتتشوّه. رواية أوسكار وايلد (1890) عن الجمال والأنانية والضمير.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/the-picture-of-dorian-gray.webp"
  },
  {
    "slug": "jekyll-and-hyde",
    "title": "The Strange Case of Dr. Jekyll and Mr. Hyde",
    "alt_title": "الدكتور جيكل والسيد هايد",
    "author": "Robert Louis Stevenson",
    "year": 1886,
    "pages": 61,
    "level": "B2",
    "category": "gothic",
    "status": "published",
    "description": "الدكتور جيكل رجل محترم، والسيد هايد رجل شرس بيظهر بلندن بالليل. رواية قصيرة وسريعة (1886) عن الوجه الخفي جوّا كل واحد فينا، ومنها إجا التعبير الإنجليزي «Jekyll and Hyde» للشخص ذو الوجهين.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/jekyll-and-hyde.webp"
  },
  {
    "slug": "treasure-island",
    "title": "Treasure Island",
    "alt_title": "جزيرة الكنز",
    "author": "Robert Louis Stevenson",
    "year": 1883,
    "pages": 171,
    "level": "B2",
    "category": "adventure",
    "status": "published",
    "description": "الفتى جيم هوكنز بيلاقي خريطة كنز عند قرصان ميت، وبيطلع على سفينة تدوّر على الجزيرة، ومعه طاقم فيه الغامض جون سيلفر. رواية مغامرات (1883) هي اللي رسمت صورة القراصنة بالخيال: خريطة عليها علامة X وببغاء على الكتف.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/treasure-island.webp"
  },
  {
    "slug": "the-time-machine",
    "title": "The Time Machine",
    "alt_title": "آلة الزمن",
    "author": "H. G. Wells",
    "year": 1895,
    "pages": 73,
    "level": "B2",
    "category": "adventure",
    "status": "published",
    "description": "مخترع بيصنع آلة بتسافر بالزمن وبيوصل لسنة 802701، وهناك بيلاقي بشر ناعمين وضعاف فوق الأرض، ومخلوقات مخيفة تحتها. رواية هـ. ج. ويلز القصيرة (1895) اللي بدأت قصص السفر عبر الزمن بالخيال العلمي.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/the-time-machine.webp"
  },
  {
    "slug": "alices-adventures-in-wonderland",
    "title": "Alice's Adventures in Wonderland",
    "alt_title": "أليس في بلاد العجائب",
    "author": "Lewis Carroll",
    "year": 1865,
    "pages": 96,
    "level": "B2",
    "category": "fantasy",
    "status": "published",
    "description": "أليس بتلحق أرنب أبيض لابس ساعة، وبتقع بجحره لعالم كل شي فيه معكوس: كائنات بتحكي، وحفلة شاي ما بتخلص، وملكة بتصرخ «اقطعوا راسه!». حكاية لويس كارول (1865) للصغار وللكبار، وبتتعلم منها إنجليزي بمتعة. فيها رسومات جون تينيل الأصلية.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/alices-adventures-in-wonderland.webp"
  },
  {
    "slug": "the-wonderful-wizard-of-oz",
    "title": "The Wonderful Wizard of Oz",
    "alt_title": "ساحر أوز العجيب",
    "author": "L. Frank Baum",
    "year": 1900,
    "pages": 111,
    "level": "B1",
    "category": "fantasy",
    "status": "published",
    "description": "دوروثي، بنت من كانساس، بتاخدها عاصفة لأرض أوز السحرية. بتمشي على الطريق الأصفر مع رجل القش ورجل الصفيح والأسد الجبان لتوصل للساحر اللي ممكن يرجّعها لبيتها. حكاية 1900 للكاتب ل. فرانك باوم بلغة بسيطة وواضحة.\n\nالنسخة: Standard Ebooks (ملك عام).",
    "cover_path": "/book-covers/the-wonderful-wizard-of-oz.webp"
  }
]$json$::jsonb;
  c       jsonb;
  b       jsonb;
  v_ids   jsonb := '{}'::jsonb;
  v_id    uuid;
  v_sort  integer;
  v_key   text;
  v_added integer := 0;
  v_kept  integer := 0;
  v_pos   jsonb := '{}'::jsonb;
  v_n     integer;
begin
  if to_regprocedure('public.book_key(text)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'books' and column_name = 'import_key'
     ) then
    raise exception 'starter_library_needs_library_updates'
      using hint = 'Apply the library database updates (status, import key) first.';
  end if;

  for c in select * from jsonb_array_elements(v_cats) loop
    select id into v_id from public.book_categories
      where public.book_key(name_en) = public.book_key(c->>'name_en')
         or public.book_key(name_ar) = public.book_key(c->>'name_ar')
      order by created_at
      limit 1;
    if v_id is null then
      select coalesce(max(sort), -1) + 1 into v_sort from public.book_categories;
      insert into public.book_categories (name_ar, name_en, color, icon, sort)
      values (c->>'name_ar', c->>'name_en', c->>'color', c->>'icon', v_sort)
      returning id into v_id;
    end if;
    v_ids := v_ids || jsonb_build_object(c->>'key', v_id);
  end loop;

  for b in select * from jsonb_array_elements(v_books) loop
    v_key := public.book_key(b->>'title') || '|' || public.book_key(b->>'author');
    v_n := coalesce((v_pos->>(b->>'category'))::integer, 0);
    v_pos := v_pos || jsonb_build_object(b->>'category', v_n + 1);
    if exists (
      select 1 from public.books x
      where x.import_key = v_key
         or (public.book_key(x.title) = public.book_key(b->>'title')
             and public.book_key(x.author) = public.book_key(b->>'author'))
    ) then
      v_kept := v_kept + 1;
      continue;
    end if;
    insert into public.books (
      title, alt_title, author, description, category_id, level, language, pages, year,
      cover_path, status, rights_checked, import_key, sort
    ) values (
      b->>'title',
      b->>'alt_title',
      b->>'author',
      b->>'description',
      (v_ids->>(b->>'category'))::uuid,
      b->>'level',
      'en',
      (b->>'pages')::integer,
      (b->>'year')::integer,
      b->>'cover_path',
      b->>'status',
      b->>'status' = 'published',
      v_key,
      v_n
    );
    v_added := v_added + 1;
  end loop;

  raise notice 'starter library: % books added, % already there', v_added, v_kept;
end
$starter$;
