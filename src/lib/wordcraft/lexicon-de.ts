// Wordcraft's German word list: hand-picked German words for Arabic-speaking learners (A1–B1),
// each with one meaning only, its Arabic meaning, and a short German example with its Arabic
// translation. Same rules as the English list (lexicon.ts): no violent or sensitive words, every
// Arabic meaning different from every other one. Words are in capitals as on the board; Ä, Ö and Ü
// are letters of their own, and words with ß are left out (it has no clear capital form).
//
// One line per word: WORD | part of speech | level (1 = A1, 2 = A2, 3 = B1) | Arabic |
// example | Arabic example.
import type { Entry } from "./lexicon.ts";

const RAW = `
HAUS|noun|1|بيت|Das Haus ist groß.|البيت كبير.
HUND|noun|1|كلب|Der Hund spielt im Garten.|الكلب بيلعب بالحديقة.
BAUM|noun|1|شجرة|Der Baum ist sehr alt.|الشجرة قديمة كثير.
BROT|noun|1|خبز|Ich kaufe Brot beim Bäcker.|بشتري خبز من المخبز.
BUCH|noun|1|كتاب|Das Buch liegt auf dem Tisch.|الكتاب على الطاولة.
HAND|noun|1|يد|Gib mir deine Hand.|أعطيني إيدك.
KOPF|noun|1|رأس|Mein Kopf tut weh.|راسي بيوجعني.
AUGE|noun|1|عين|Mein linkes Auge ist rot.|عيني الشمال حمرا.
NASE|noun|1|أنف|Meine Nase ist kalt.|أنفي بارد.
MUND|noun|1|فم|Mach bitte den Mund auf.|افتح ثمك لو سمحت.
BALL|noun|1|كرة|Das Kind wirft den Ball.|الولد بيرمي الطابة.
AUTO|noun|1|سيارة|Unser Auto ist rot.|سيارتنا حمرا.
SAFT|noun|1|عصير|Ich trinke gern Saft.|بحب أشرب عصير.
REIS|noun|1|أرز|Wir essen Reis mit Huhn.|بناكل رز مع جاج.
OBST|noun|1|فاكهة|Obst ist sehr gesund.|الفواكه صحية كثير.
JAHR|noun|1|سنة|Ein Jahr hat zwölf Monate.|السنة فيها ١٢ شهر.
ZEIT|noun|1|وقت|Ich habe heute keine Zeit.|ما عندي وقت اليوم.
GELD|noun|1|مال|Ich habe kein Geld dabei.|ما معي مصاري.
WORT|noun|1|كلمة|Das Wort ist neu für mich.|الكلمة جديدة علي.
NAME|noun|1|اسم|Mein Name ist Ali.|اسمي علي.
BETT|noun|1|سرير|Das Bett ist bequem.|السرير مريح.
BILD|noun|1|صورة|Das Bild hängt an der Wand.|الصورة معلّقة عالحيط.
WAND|noun|1|حائط|Die Wand ist weiß.|الحيط أبيض.
ROSE|noun|1|وردة|Sie hat eine rote Rose.|معها وردة حمرا.
MOND|noun|1|قمر|Der Mond ist heute hell.|القمر منوّر اليوم.
LAND|noun|1|بلد|Jordanien ist ein schönes Land.|الأردن بلد حلو.
BERG|noun|1|جبل|Der Berg ist sehr hoch.|الجبل عالي كثير.
WIND|noun|1|ريح|Der Wind ist heute stark.|الريح قوية اليوم.
WARM|adj|1|دافئ|Heute ist es warm.|الجو دافي اليوم.
LAUT|adj|1|صاخب|Die Musik ist zu laut.|الموسيقى صوتها عالي كثير.
LEER|adj|2|فارغ|Der Kühlschrank ist leer.|الثلاجة فاضية.
VOLL|adj|2|ممتلئ|Der Bus ist voll.|الباص مليان.
KURZ|adj|2|قصير|Der Weg ist kurz.|الطريق قصير.
LANG|adj|1|طويل|Der Film ist lang.|الفيلم طويل.
BLAU|adj|1|أزرق|Der Himmel ist blau.|السما زرقا.
GELB|adj|1|أصفر|Die Banane ist gelb.|الموزة صفرا.
GRÜN|adj|1|أخضر|Das Gras ist grün.|العشب أخضر.
GRAU|adj|2|رمادي|Die Katze ist grau.|القطة رمادية.
KIND|noun|1|طفل|Das Kind lacht viel.|الطفل بيضحك كثير.
MANN|noun|1|رجل|Der Mann liest die Zeitung.|الرجل بيقرأ الجريدة.
FRAU|noun|1|امرأة|Die Frau arbeitet hier.|المرأة بتشتغل هون.
SOHN|noun|1|ابن|Mein Sohn ist fünf Jahre alt.|ابني عمره خمس سنين.
FLUG|noun|2|رحلة|Der Flug dauert drei Stunden.|الرحلة بتاخد ثلاث ساعات.
HOSE|noun|1|بنطلون|Die Hose ist zu lang.|البنطلون طويل كثير.
HEMD|noun|1|قميص|Er trägt ein weißes Hemd.|لابس قميص أبيض.
HAAR|noun|1|شعر|Ihr Haar ist lang.|شعرها طويل.
ARZT|noun|1|طبيب|Der Arzt hilft mir.|الدكتور بيساعدني.
HERZ|noun|2|قلب|Mein Herz schlägt schnell.|قلبي بيدق بسرعة.
FILM|noun|1|فيلم|Der Film ist spannend.|الفيلم مشوّق.
LIED|noun|2|أغنية|Das Lied ist schön.|الأغنية حلوة.
KÄSE|noun|1|جبن|Ich esse Brot mit Käse.|باكل خبز مع جبنة.
HUHN|noun|2|دجاجة|Das Huhn legt ein Ei.|الجاجة بتبيض بيضة.
ENTE|noun|2|بطة|Die Ente schwimmt im See.|البطة بتسبح بالبحيرة.
MAUS|noun|1|فأر|Die Katze sieht eine Maus.|القطة شافت فار.
MEER|noun|1|بحر|Im Sommer fahren wir ans Meer.|بالصيف بنروح عالبحر.
SAND|noun|2|رمل|Der Sand ist warm.|الرمل دافي.
KOCH|noun|2|طباخ|Der Koch macht eine Suppe.|الطباخ بيعمل شوربة.
POST|noun|2|بريد|Die Post kommt am Morgen.|البريد بيوصل الصبح.
BANK|noun|1|بنك|Ich gehe heute zur Bank.|رايح عالبنك اليوم.
WEIT|adj|2|بعيد|Die Schule ist nicht weit.|المدرسة مش بعيدة.
HELL|adj|2|مضيء|Das Zimmer ist hell.|الغرفة منوّرة.
KLUG|adj|2|ذكي|Das Mädchen ist sehr klug.|البنت ذكية كثير.
MÜDE|adj|1|متعب|Ich bin heute sehr müde.|أنا تعبان كثير اليوم.
FROH|adj|2|مسرور|Ich bin froh, dich zu sehen.|مبسوط إني شفتك.
KINO|noun|1|سينما|Wir gehen heute ins Kino.|رايحين عالسينما اليوم.
LÖWE|noun|2|أسد|Der Löwe schläft im Schatten.|الأسد نايم بالفي.
SPÄT|adj|1|متأخر|Es ist schon spät.|صار الوقت متأخر.
FRÜH|adj|1|باكر|Ich stehe früh auf.|بصحى بكير.
BÜRO|noun|1|مكتب|Ich arbeite im Büro.|بشتغل بالمكتب.
MEHL|noun|2|طحين|Für den Kuchen brauchen wir Mehl.|للكيك بدنا طحين.
ENDE|noun|2|نهاية|Das Ende des Films ist gut.|نهاية الفيلم حلوة.
ZIEL|noun|3|هدف|Mein Ziel ist klar.|هدفي واضح.
RUHE|noun|3|هدوء|Ich brauche jetzt Ruhe.|بحتاج هدوء هلأ.
TISCH|noun|1|طاولة|Der Tisch ist aus Holz.|الطاولة من خشب.
STUHL|noun|1|كرسي|Der Stuhl ist neu.|الكرسي جديد.
KATZE|noun|1|قطة|Die Katze schläft auf dem Sofa.|القطة نايمة عالكنباية.
MILCH|noun|1|حليب|Das Kind trinkt Milch.|الطفل بيشرب حليب.
WOCHE|noun|1|أسبوع|Die Woche hat sieben Tage.|الأسبوع فيه سبع أيام.
MONAT|noun|1|شهر|Der Monat ist fast vorbei.|الشهر قرّب يخلص.
ABEND|noun|1|مساء|Am Abend lese ich gern.|بالمسا بحب أقرأ.
NACHT|noun|1|ليل|Die Nacht ist ruhig.|الليل هادي.
STADT|noun|1|مدينة|Amman ist eine große Stadt.|عمّان مدينة كبيرة.
FISCH|noun|1|سمك|Heute essen wir Fisch.|اليوم بناكل سمك.
VOGEL|noun|1|عصفور|Der Vogel singt am Morgen.|العصفور بيغني الصبح.
BLUME|noun|1|زهرة|Die Blume ist gelb.|الزهرة صفرا.
LAMPE|noun|1|مصباح|Mach bitte die Lampe an.|ولّع الضو لو سمحت.
TASSE|noun|1|فنجان|Eine Tasse Tee, bitte.|فنجان شاي لو سمحت.
APFEL|noun|1|تفاحة|Der Apfel ist rot.|التفاحة حمرا.
KLEIN|adj|1|صغير|Mein Bruder ist noch klein.|أخوي لسا صغير.
SCHÖN|adj|1|جميل|Das Wetter ist schön.|الجو حلو.
LESEN|verb|1|يقرأ|Ich lese gern Bücher.|بحب أقرأ كتب.
GEHEN|verb|1|يذهب|Wir gehen nach Hause.|رايحين عالبيت.
ESSEN|verb|1|يأكل|Wir essen um sieben Uhr.|بناكل الساعة سبعة.
SAGEN|verb|1|يقول|Was sagen Sie?|شو بتقول حضرتك؟
MALEN|verb|2|يرسم|Das Kind malt ein Haus.|الطفل بيرسم بيت.
HOLEN|verb|2|يجلب|Ich hole schnell das Brot.|بجيب الخبز بسرعة.
LEBEN|verb|2|يعيش|Ich lebe in Amman.|أنا عايش بعمّان.
BRIEF|noun|2|رسالة|Ich schreibe einen Brief.|بكتب رسالة.
BAUCH|noun|2|بطن|Mein Bauch tut weh.|بطني بيوجعني.
NEBEL|noun|2|ضباب|Heute gibt es viel Nebel.|اليوم في ضباب كثير.
REGEN|noun|1|مطر|Der Regen ist stark.|المطر قوي.
SONNE|noun|1|شمس|Die Sonne scheint.|الشمس طالعة.
STERN|noun|2|نجمة|Ich sehe einen Stern.|شايف نجمة.
INSEL|noun|2|جزيرة|Die Insel ist klein.|الجزيرة صغيرة.
WAGEN|noun|2|عربة|Der Wagen steht vor dem Haus.|العربية واقفة قدام البيت.
HONIG|noun|2|عسل|Ich mag Honig zum Frühstück.|بحب العسل عالفطور.
TORTE|noun|2|كعكة|Die Torte ist süß.|الكعكة حلوة.
SALAT|noun|1|سلطة|Ich esse einen Salat.|باكل سلطة.
SUPPE|noun|1|شوربة|Die Suppe ist heiß.|الشوربة سخنة.
HOTEL|noun|1|فندق|Das Hotel ist am Meer.|الفندق عالبحر.
TIGER|noun|2|نمر|Der Tiger ist stark.|النمر قوي.
PFERD|noun|1|حصان|Das Pferd läuft schnell.|الحصان بيركض بسرعة.
SCHAF|noun|2|خروف|Das Schaf ist weiß.|الخروف أبيض.
ONKEL|noun|1|عم|Mein Onkel wohnt in Berlin.|عمي ساكن ببرلين.
TANTE|noun|1|عمة|Meine Tante kocht sehr gut.|عمتي بتطبخ منيح كثير.
FRAGE|noun|1|سؤال|Ich habe eine Frage.|عندي سؤال.
SPORT|noun|1|رياضة|Sport macht Spaß.|الرياضة ممتعة.
SPIEL|noun|1|لعبة|Das Spiel ist einfach.|اللعبة سهلة.
MUSIK|noun|1|موسيقى|Ich höre gern Musik.|بحب أسمع موسيقى.
KLEID|noun|1|فستان|Das Kleid ist blau.|الفستان أزرق.
JACKE|noun|1|سترة|Nimm deine Jacke mit.|خذ جاكيتك معك.
SCHUH|noun|1|حذاء|Der Schuh ist zu klein.|الحذاء صغير.
MÜTZE|noun|2|قبعة|Die Mütze ist warm.|القبعة دافية.
TEUER|adj|2|غالي|Das Auto ist teuer.|السيارة غالية.
LEISE|adj|2|خافت|Bitte sprich leise.|احكي بصوت واطي لو سمحت.
RUHIG|adj|2|هادئ|Der Abend ist ruhig.|المسا هادي.
KRANK|adj|1|مريض|Ich bin heute krank.|أنا مريض اليوم.
STARK|adj|1|قوي|Der Kaffee ist stark.|القهوة قوية.
TRAUM|noun|2|حلم|Ich hatte einen schönen Traum.|حلمت حلم حلو.
FARBE|noun|1|لون|Welche Farbe magst du?|أي لون بتحب؟
PAUSE|noun|1|استراحة|Wir machen eine Pause.|بنعمل استراحة.
KÜCHE|noun|1|مطبخ|Die Küche ist sauber.|المطبخ نظيف.
GABEL|noun|2|شوكة|Ich esse mit der Gabel.|باكل بالشوكة.
WOLKE|noun|2|غيمة|Die Wolke ist grau.|الغيمة رمادية.
TAFEL|noun|2|سبورة|Schreib das an die Tafel.|اكتبها عاللوح.
ÄRGER|noun|3|متاعب|Mach bitte keinen Ärger.|لا تعمل مشاكل لو سمحت.
MITTE|noun|3|وسط|Das Haus steht in der Mitte.|البيت بالنص.
KUNDE|noun|3|زبون|Der Kunde wartet schon.|الزبون مستني من زمان.
ANGST|noun|3|خوف|Ich habe keine Angst.|ما بخاف.
THEMA|noun|3|موضوع|Das Thema ist interessant.|الموضوع ممتع.
PLATZ|noun|2|مكان|Ist der Platz noch frei?|المكان لسا فاضي؟
NATUR|noun|2|طبيعة|Ich liebe die Natur.|بحب الطبيعة.
WASSER|noun|1|ماء|Ich trinke viel Wasser.|بشرب مي كثير.
KAFFEE|noun|1|قهوة|Der Kaffee ist heiß.|القهوة سخنة.
ZIMMER|noun|1|غرفة|Mein Zimmer ist klein.|غرفتي صغيرة.
SCHULE|noun|1|مدرسة|Die Schule beginnt um acht.|المدرسة بتبلش الساعة ثمانية.
KAUFEN|verb|2|يشتري|Ich will ein Buch kaufen.|بدي أشتري كتاب.
SINGEN|verb|2|يغني|Sie singt sehr schön.|بتغني حلو كثير.
LERNEN|verb|1|يتعلم|Ich lerne jeden Tag Deutsch.|بتعلّم ألماني كل يوم.
KOCHEN|verb|2|يطبخ|Mein Vater kocht heute.|أبوي بيطبخ اليوم.
HIMMEL|noun|1|سماء|Der Himmel ist klar.|السما صافية.
BUTTER|noun|2|زبدة|Brot mit Butter, bitte.|خبز مع زبدة لو سمحت.
BRUDER|noun|1|أخ|Mein Bruder spielt Fußball.|أخوي بيلعب كرة قدم.
ELTERN|noun|2|أهل|Meine Eltern wohnen in Irbid.|أهلي ساكنين بإربد.
FREUND|noun|1|صديق|Er ist mein bester Freund.|هو أعز صحابي.
ARBEIT|noun|2|عمل|Die Arbeit ist interessant.|الشغل ممتع.
MITTAG|noun|2|الظهيرة|Zu Mittag esse ich zu Hause.|عالظهر باكل بالبيت.
HERBST|noun|2|خريف|Im Herbst fallen die Blätter.|بالخريف بيوقع الورق.
WINTER|noun|1|شتاء|Der Winter ist kalt.|الشتا بارد.
SOMMER|noun|1|صيف|Im Sommer ist es heiß.|بالصيف الجو شوب.
MORGEN|noun|1|صباح|Am Morgen trinke ich Tee.|الصبح بشرب شاي.
ZUCKER|noun|2|سكر|Kaffee ohne Zucker, bitte.|قهوة بدون سكر لو سمحت.
TELLER|noun|2|صحن|Der Teller ist leer.|الصحن فاضي.
LEICHT|adj|2|سهل|Die Aufgabe ist leicht.|الواجب سهل.
SCHWER|adj|2|صعب|Deutsch ist nicht so schwer.|الألماني مش صعب لهالدرجة.
LUSTIG|adj|2|مضحك|Der Film ist lustig.|الفيلم مضحك.
GARTEN|noun|1|حديقة|Die Kinder spielen im Garten.|الأولاد بيلعبوا بالحديقة.
STRAND|noun|2|شاطئ|Wir liegen am Strand.|قاعدين عالشط.
REISEN|verb|2|يسافر|Ich reise gern mit dem Zug.|بحب أسافر بالقطار.
WOHNEN|verb|2|يسكن|Wir wohnen in Amman.|ساكنين بعمّان.
TASCHE|noun|1|حقيبة|Die Tasche ist schwer.|الشنطة ثقيلة.
BRILLE|noun|2|نظارة|Ich brauche eine Brille.|بحتاج نظارة.
DUSCHE|noun|2|دش|Die Dusche ist kaputt.|الدش خربان.
KISSEN|noun|2|وسادة|Das Kissen ist weich.|المخدة طرية.
GESUND|adj|2|معافى|Ich bin wieder gesund.|رجعت صحتي منيحة.
FALSCH|adj|2|خاطئ|Das ist leider falsch.|للأسف هاد غلط.
SAUBER|adj|2|نظيف|Das Zimmer ist sauber.|الغرفة نظيفة.
SCHNEE|noun|1|ثلج|Im Winter gibt es Schnee.|بالشتا في ثلج.
KUCHEN|noun|1|كيك|Der Kuchen schmeckt gut.|الكيك طعمه زاكي.
BANANE|noun|1|موزة|Die Banane ist süß.|الموزة حلوة.
GEMÜSE|noun|2|خضار|Gemüse ist gesund.|الخضار صحية.
KLASSE|noun|2|صف|Unsere Klasse ist groß.|صفنا كبير.
LEHRER|noun|1|معلم|Der Lehrer erklärt die Regel.|الأستاذ بيشرح القاعدة.
MANTEL|noun|2|معطف|Der Mantel ist warm.|المعطف دافي.
WETTER|noun|1|طقس|Wie ist das Wetter heute?|كيف الطقس اليوم؟
LÖFFEL|noun|2|ملعقة|Ich brauche einen Löffel.|بدي معلقة.
GEDULD|noun|3|صبر|Du brauchst Geduld.|بدك صبر.
ERFOLG|noun|3|نجاح|Ich wünsche dir viel Erfolg.|بتمنالك النجاح.
GEFAHR|noun|3|خطر|Achtung, Gefahr!|انتبه، خطر!
WARTEN|verb|2|ينتظر|Ich warte auf den Bus.|بستنى الباص.
SUCHEN|verb|2|يبحث|Ich suche meine Brille.|بدوّر على نظارتي.
FINDEN|verb|2|يجد|Ich finde den Weg nicht.|مش لاقي الطريق.
HELFEN|verb|1|يساعد|Kannst du mir helfen?|بتقدر تساعدني؟
FRAGEN|verb|1|يسأل|Darf ich etwas fragen?|ممكن أسأل إشي؟
TANZEN|verb|2|يرقص|Wir tanzen auf der Feier.|بنرقص بالحفلة.
LACHEN|verb|1|يضحك|Die Kinder lachen viel.|الأولاد بيضحكوا كثير.
WEINEN|verb|2|يبكي|Das Baby weint.|البيبي بيبكي.
KOMMEN|verb|1|يأتي|Kommst du heute?|جاي اليوم؟
ÖFFNEN|verb|2|يفتح|Kannst du das Fenster öffnen?|بتقدر تفتح الشباك؟
URLAUB|noun|2|إجازة|Im Sommer machen wir Urlaub.|بالصيف بناخد إجازة.
RÜCKEN|noun|2|ظهر|Mein Rücken tut weh.|ظهري بيوجعني.
FINGER|noun|1|إصبع|Ich habe zehn Finger.|عندي عشر أصابع.
UMWELT|noun|3|بيئة|Wir schützen die Umwelt.|بنحمي البيئة.
GESETZ|noun|3|قانون|Das Gesetz ist neu.|القانون جديد.
LÖSUNG|noun|3|حل|Wir finden eine Lösung.|بنلاقي حل.
GRENZE|noun|3|حدود|Die Grenze ist nah.|الحدود قريبة.
ANFANG|noun|3|بداية|Am Anfang war es schwer.|بالبداية كانت صعبة.
FREUDE|noun|3|فرح|Das macht mir Freude.|هاد بيفرحني.
GRUPPE|noun|3|مجموعة|Wir arbeiten in einer Gruppe.|بنشتغل بمجموعة.
STIMME|noun|3|صوت|Sie hat eine schöne Stimme.|صوتها حلو.
STUNDE|noun|2|ساعة|Der Kurs dauert eine Stunde.|الدورة بتاخد ساعة.
MINUTE|noun|2|دقيقة|Warte bitte eine Minute!|استنى دقيقة لو سمحت!
HEIMAT|noun|3|وطن|Jordanien ist meine Heimat.|الأردن وطني.
KULTUR|noun|3|ثقافة|Die Kultur ist reich.|الثقافة غنية.
FENSTER|noun|1|شباك|Mach das Fenster auf.|افتح الشباك.
TRINKEN|verb|1|يشرب|Was möchtest du trinken?|شو بدك تشرب؟
RICHTIG|adj|2|صحيح|Die Antwort ist richtig.|الجواب صح.
WICHTIG|adj|3|مهم|Das ist sehr wichtig.|هاد مهم كثير.
FLASCHE|noun|2|زجاجة|Die Flasche ist leer.|القنينة فاضية.
ANTWORT|noun|2|إجابة|Die Antwort ist kurz.|الجواب قصير.
ZEITUNG|noun|2|جريدة|Mein Opa liest die Zeitung.|سيدي بيقرأ الجريدة.
BAHNHOF|noun|2|محطة|Der Bahnhof ist in der Nähe.|المحطة قريبة.
FAMILIE|noun|1|عائلة|Meine Familie ist groß.|عيلتي كبيرة.
SPIEGEL|noun|2|مرآة|Sie schaut in den Spiegel.|بتطلع بالمراية.
TEPPICH|noun|2|سجادة|Der Teppich ist rot.|السجادة حمرا.
SCHRANK|noun|2|خزانة|Die Kleider sind im Schrank.|الأواعي بالخزانة.
PFLANZE|noun|3|نبتة|Die Pflanze braucht Wasser.|النبتة بدها مي.
MEINUNG|noun|3|رأي|Was ist deine Meinung?|شو رأيك؟
ZUKUNFT|noun|3|مستقبل|Die Zukunft ist offen.|المستقبل مفتوح.
SPIELEN|verb|1|يلعب|Wir spielen Fußball.|بنلعب كرة قدم.
SCHNELL|adj|1|سريع|Das Auto ist schnell.|السيارة سريعة.
ZWIEBEL|noun|2|بصلة|Ich schneide eine Zwiebel.|بقطّع بصلة.
HUNGRIG|adj|2|جائع|Ich bin sehr hungrig.|أنا جوعان كثير.
DURSTIG|adj|2|عطشان|Nach dem Sport bin ich durstig.|بعد الرياضة بكون عطشان.
MÄDCHEN|noun|1|بنت|Das Mädchen liest ein Buch.|البنت بتقرأ كتاب.
KLAVIER|noun|2|بيانو|Sie spielt Klavier.|بتعزف بيانو.
GITARRE|noun|2|غيتار|Er lernt Gitarre.|بيتعلم غيتار.
FAHRRAD|noun|1|دراجة|Ich fahre mit dem Fahrrad.|بروح بالبسكليت.
SPRACHE|noun|2|لغة|Deutsch ist eine schöne Sprache.|الألماني لغة حلوة.
GESICHT|noun|2|وجه|Ihr Gesicht ist rot.|وجهها أحمر.
NACHBAR|noun|2|جار|Unser Nachbar ist nett.|جارنا لطيف.
KOLLEGE|noun|3|زميل|Mein Kollege hilft mir.|زميلي بيساعدني.
SEKUNDE|noun|3|ثانية|Eine Sekunde, bitte.|ثانية لو سمحت.
PROBLEM|noun|2|مشكلة|Das ist kein Problem.|مش مشكلة.
VERKEHR|noun|3|مرور|Der Verkehr ist heute schlimm.|الأزمة صعبة اليوم.
`;

export const LEXICON_DE: readonly Entry[] = RAW.trim()
  .split("\n")
  .map((line) => {
    const [word, pos, level, ar, example, exampleAr] = line.split("|");
    return {
      word,
      pos: pos as Entry["pos"],
      level: Number(level) as Entry["level"],
      ar,
      example,
      exampleAr,
    };
  });

export const BY_WORD_DE: ReadonlyMap<string, Entry> = new Map(LEXICON_DE.map((e) => [e.word, e]));

/**
 * Common German words that are not puzzle words, so a player who traces one hears "a real word,
 * but not one of this puzzle's" instead of "not a word".
 */
export const EXTRA_WORDS_DE: readonly string[] = (
  "DER DIE DAS UND IST ICH SIE WIR IHR EIN EINE MIT AUF FÜR VON ZUM ZUR DEN DEM DES NICHT AUCH ABER " +
  "ODER WIE WAS WER WO NEIN GUT ALT NEU ROT TAG WEG ZUG UHR TÜR TEE EIS OMA OPA KUH SEE ARM NAH TUN " +
  "HAT BIN BIST SIND HAST SEIN MEIN DEIN WEIL DANN WENN NOCH SCHON SEHR VIEL MEHR HIER DORT HEUTE " +
  "GERN BALD IMMER ALLE ETWAS NUR MAL NUN JETZT HALLO DANKE BITTE ACHT ZEHN ELF EINS ZWEI DREI VIER " +
  "FÜNF SECHS SIEBEN NEUN KALT HEIß ROSA BRAUN WEIß"
)
  .split(" ")
  .filter((word) => word && !word.includes("ß"));
