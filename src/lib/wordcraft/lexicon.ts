// Wordcraft's word list: hand-picked English words for Arabic-speaking learners (A1–B1), each
// with one meaning only (the sense the clue gives), its Arabic meaning, and an example sentence
// with its Arabic translation. CEFR levels are our own estimate, not an official tag.
//
// Left out on purpose: violent or sensitive words, words whose Arabic meaning would also fit
// another word here (the clue must point to one word), and words with several common meanings
// unless the clue names the sense. Every Arabic meaning is different from every other one.
//
// One line per word: WORD | part of speech | level (1 = A1, 2 = A2, 3 = B1) | Arabic |
// example | Arabic example.

export type Entry = {
  word: string;
  pos: "noun" | "verb" | "adj" | "adv" | "prep";
  level: 1 | 2 | 3;
  ar: string;
  example: string;
  exampleAr: string;
};

export const LEXICON_VERSION = 1;

const RAW = `
HAND|noun|1|يد|Raise your hand if you know the answer.|ارفع يدك إذا بتعرف الجواب.
HOME|noun|1|بيت|I am at home now.|أنا بالبيت هلأ.
BOOK|noun|1|كتاب|This book is very interesting.|هاد الكتاب ممتع كثير.
TREE|noun|1|شجرة|There is a big tree in our garden.|في شجرة كبيرة بحديقتنا.
FISH|noun|1|سمكة|The fish swims in the water.|السمكة بتسبح بالمي.
BIRD|noun|1|طائر|A small bird is singing.|في طير صغير عم يغني.
FOOD|noun|1|طعام|The food smells good.|ريحة الأكل طيبة.
MILK|noun|1|حليب|She drinks milk every morning.|بتشرب حليب كل صبح.
RICE|noun|1|أرز|We eat rice with chicken.|بناكل رز مع جاج.
CAKE|noun|1|كعكة|Mum made a chocolate cake.|ماما عملت كعكة شوكولاتة.
DOOR|noun|1|باب|Please close the door.|سكّر الباب لو سمحت.
ROOM|noun|1|غرفة|My room is small but nice.|غرفتي صغيرة بس حلوة.
BOAT|noun|1|قارب|They went fishing in a boat.|راحوا يصطادوا بقارب.
ROAD|noun|1|طريق|This road goes to the city.|هاد الطريق بيوصل للمدينة.
CITY|noun|1|مدينة|Amman is a big city.|عمّان مدينة كبيرة.
LAKE|noun|2|بحيرة|The lake is cold in winter.|البحيرة باردة بالشتا.
SNOW|noun|1|ثلج|The children play in the snow.|الأولاد بيلعبوا بالثلج.
RAIN|noun|1|مطر|Take an umbrella, there is rain today.|خذ شمسية، في مطر اليوم.
WIND|noun|2|رياح|The wind is strong tonight.|الريح قوية الليلة.
STAR|noun|1|نجمة|I can see a bright star.|بشوف نجمة لامعة.
MOON|noun|1|قمر|The moon is full tonight.|القمر بدر الليلة.
SAND|noun|2|رمل|The sand on the beach is hot.|رمل الشط شوب.
FIRE|noun|2|نار|We sat around the fire.|قعدنا حوالين النار.
GOLD|noun|2|ذهب|Her ring is made of gold.|خاتمها من ذهب.
BLUE|adj|1|أزرق|The sky is blue today.|السما زرقا اليوم.
PINK|adj|1|وردي|She has a pink bag.|معها شنطة وردية.
NOSE|noun|1|أنف|The clown has a red nose.|المهرّج إله أنف أحمر.
FACE|noun|1|وجه|Wash your face with water.|اغسل وجهك بالمي.
HAIR|noun|1|شعر|Her hair is long and black.|شعرها طويل وأسود.
KNEE|noun|2|ركبة|I hurt my knee playing football.|وجعتني ركبتي وأنا بلعب طابة.
FOOT|noun|1|قدم|My left foot is cold.|رجلي الشمال باردة.
BODY|noun|2|جسم|Sport is good for your body.|الرياضة منيحة لجسمك.
BABY|noun|1|طفل رضيع|The baby is sleeping.|البيبي نايم.
GIRL|noun|1|بنت|The girl is reading a story.|البنت عم تقرأ قصة.
KING|noun|2|ملك|The king lives in a palace.|الملك ساكن بقصر.
BALL|noun|1|كرة|Kick the ball to me.|اشلح الطابة عليّ.
GAME|noun|1|لعبة|This game is easy to learn.|هاي اللعبة سهلة تتعلمها.
SONG|noun|1|أغنية|I love this song.|بحب هاي الأغنية.
BELL|noun|2|جرس|The school bell rings at eight.|جرس المدرسة بيرن الساعة ثمانية.
DESK|noun|2|طاولة الدراسة|My books are on my desk.|كتبي على طاولة الدراسة.
LAMP|noun|2|مصباح|Turn on the lamp, please.|شغّل المصباح لو سمحت.
COAT|noun|1|معطف|Wear your coat, it is cold.|البس المعطف، الجو برد.
SHOE|noun|1|حذاء|I lost one shoe.|ضيّعت فردة حذاء.
SOAP|noun|2|صابون|Wash your hands with soap.|اغسل إيديك بالصابون.
GIFT|noun|2|هدية|Thank you for the gift.|شكراً على الهدية.
WORD|noun|1|كلمة|What does this word mean?|شو معنى هاي الكلمة؟
NAME|noun|1|اسم|What is your name?|شو اسمك؟
YEAR|noun|1|سنة|I started English last year.|بلّشت إنجليزي السنة الماضية.
WEEK|noun|1|أسبوع|See you next week.|بشوفك الأسبوع الجاي.
HOUR|noun|1|ساعة (ستون دقيقة)|The film is two hours long.|الفيلم مدته ساعتين.
TIME|noun|1|وقت|I have no time today.|ما عندي وقت اليوم.
LIFE|noun|2|حياة|Life is beautiful.|الحياة حلوة.
IDEA|noun|2|فكرة|That is a great idea!|هاي فكرة رائعة!
PLAN|noun|2|خطة|We need a plan for the trip.|بدنا خطة للرحلة.
WORK|noun|1|عمل|He goes to work by bus.|بيروح عالشغل بالباص.
HELP|verb|1|يساعد|Can you help me, please?|بتقدر تساعدني لو سمحت؟
READ|verb|1|يقرأ|I read before I sleep.|بقرأ قبل ما أنام.
SING|verb|1|يغني|She likes to sing in the car.|بتحب تغني بالسيارة.
SWIM|verb|1|يسبح|Can you swim?|بتعرف تسبح؟
WALK|verb|1|يمشي|We walk to school.|بنمشي عالمدرسة.
JUMP|verb|1|يقفز|The cat can jump very high.|القطة بتقدر تقفز عالي كثير.
COOK|verb|1|يطبخ|My father likes to cook.|أبوي بحب يطبخ.
PLAY|verb|1|يلعب|Let's play outside.|يلا نلعب برا.
OPEN|verb|1|يفتح|Open your books, please.|افتحوا كتبكم لو سمحتوا.
MOVE|verb|2|يتحرك|Don't move, I am taking a photo.|لا تتحرك، عم بصوّر.
STOP|verb|1|يتوقف|The bus stops here.|الباص بيوقف هون.
WAIT|verb|1|ينتظر|Please wait for me.|استناني لو سمحت.
CALL|verb|1|يتصل|I will call you tonight.|رح أتصل فيك الليلة.
SEND|verb|2|يرسل|Send me a message.|ابعتلي رسالة.
GIVE|verb|1|يعطي|Give me the pen, please.|أعطيني القلم لو سمحت.
TAKE|verb|1|يأخذ|Take this book with you.|خذ هاد الكتاب معك.
KEEP|verb|2|يحتفظ|You can keep the change.|خلّي الباقي معك.
FIND|verb|1|يجد|I can't find my keys.|مش لاقي مفاتيحي.
LIVE|verb|1|يسكن|We live near the sea.|ساكنين قريب من البحر.
LOVE|verb|1|يحب|I love my family.|بحب عيلتي.
KNOW|verb|1|يعرف|I know the answer.|بعرف الجواب.
HEAR|verb|1|يسمع|Can you hear me?|سامعني؟
LOOK|verb|1|ينظر|Look at the board.|اطّلع عاللوح.
FEEL|verb|2|يشعر|I feel happy today.|حاسس حالي مبسوط اليوم.
DRAW|verb|1|يرسم|The children draw animals.|الأولاد بيرسموا حيوانات.
COLD|adj|1|بارد|The water is cold.|المي باردة.
WARM|adj|1|دافئ|This jacket is warm.|هاي الجاكيت دافية.
FAST|adj|1|سريع|This car is very fast.|هاي السيارة سريعة كثير.
SLOW|adj|1|بطيء|The old computer is slow.|الكمبيوتر القديم بطيء.
TALL|adj|1|طويل القامة|My brother is tall.|أخوي طويل.
EASY|adj|1|سهل|The test was easy.|الامتحان كان سهل.
HARD|adj|1|صعب|This question is hard.|هاد السؤال صعب.
NEAR|prep|1|قريب من|The shop is near my house.|الدكان قريب من بيتي.
SOFT|adj|2|ناعم|The cat's fur is soft.|فرو القطة ناعم.
NICE|adj|1|لطيف|Your teacher is very nice.|أستاذك لطيف كثير.
GOOD|adj|1|جيد|This is a good book.|هاد كتاب منيح.
FULL|adj|2|ممتلئ|The bus is full.|الباص مليان.
DARK|adj|1|مظلم|The room is dark.|الغرفة معتمة.
LATE|adj|1|متأخر|Sorry, I am late.|آسف، تأخرت.
LAZY|adj|2|كسول|My cat is lazy.|قطتي كسولة.
BUSY|adj|1|مشغول|I am busy right now.|أنا مشغول هلأ.
WILD|adj|2|بري|Lions are wild animals.|الأسود حيوانات برية.
RICH|adj|2|غني|He is a rich man.|هو زلمة غني.
POOR|adj|2|فقير|They help poor families.|بساعدوا العائلات الفقيرة.
SAFE|adj|2|آمن|This street is safe.|هاد الشارع آمن.
HUGE|adj|2|ضخم|An elephant is huge.|الفيل ضخم.
TINY|adj|2|صغير جداً|The baby has tiny hands.|البيبي إله إيدين صغار كثير.
WISE|adj|3|حكيم|My grandfather is a wise man.|سيدي زلمة حكيم.
HOUSE|noun|1|منزل|They live in a white house.|ساكنين بمنزل أبيض.
WATER|noun|1|ماء|Drink a lot of water.|اشرب مي كثير.
TRAIN|noun|1|قطار|The train leaves at nine.|القطار بيطلع الساعة تسعة.
APPLE|noun|1|تفاحة|I eat an apple every day.|بوكل تفاحة كل يوم.
SMILE|noun|2|ابتسامة|She has a beautiful smile.|إلها ابتسامة حلوة.
MUSIC|noun|1|موسيقى|I listen to music on the bus.|بسمع موسيقى بالباص.
CHAIR|noun|1|كرسي|Sit on this chair.|اقعد على هالكرسي.
BEACH|noun|1|شاطئ|We went to the beach in summer.|رحنا عالشط بالصيف.
RIVER|noun|1|نهر|The river is very long.|النهر طويل كثير.
OCEAN|noun|2|محيط|Whales live in the ocean.|الحيتان بتعيش بالمحيط.
PLANT|noun|2|نبتة|Water the plant every day.|اسقي النبتة كل يوم.
GRASS|noun|2|عشب|The grass is green after the rain.|العشب أخضر بعد المطر.
HORSE|noun|1|حصان|He rides a horse.|بيركب حصان.
MOUSE|noun|1|فأر|The cat sees a mouse.|القطة شافت فار.
SHEEP|noun|2|خروف|The farmer has many sheep.|المزارع عنده خرفان كثير.
TIGER|noun|1|نمر|The tiger is orange and black.|النمر برتقالي وأسود.
CAMEL|noun|2|جمل|A camel can walk in the desert.|الجمل بيقدر يمشي بالصحرا.
SNAKE|noun|2|أفعى|The snake is in the grass.|الحية بالعشب.
EAGLE|noun|2|نسر|The eagle flies very high.|النسر بيطير عالي كثير.
LEMON|noun|1|ليمون|Add some lemon to the salad.|حط شوية ليمون عالسلطة.
GRAPE|noun|2|حبة عنب|This grape is sweet.|حبة العنب هاي حلوة.
SUGAR|noun|1|سكر|No sugar in my tea, please.|بدون سكر بالشاي لو سمحت.
SALAD|noun|1|سلطة|I want a green salad.|بدي سلطة خضرا.
LUNCH|noun|1|غداء|We have lunch at two.|بنتغدّى الساعة ثنتين.
NIGHT|noun|1|ليل|The city is quiet at night.|المدينة هادية بالليل.
LIGHT|noun|2|ضوء|The light is too bright.|الضو قوي كثير.
MONEY|noun|1|مال|I don't have much money.|ما معي مصاري كثير.
PAPER|noun|1|ورق|Write it on a piece of paper.|اكتبها على ورقة.
STORY|noun|1|قصة|Tell me a story.|احكيلي قصة.
PARTY|noun|1|حفلة|Come to my party on Friday.|تعال على حفلتي يوم الجمعة.
VOICE|noun|2|صوت (الإنسان)|She has a lovely voice.|صوتها حلو كثير.
HEART|noun|2|قلب|The heart is a strong muscle.|القلب عضلة قوية.
MOUTH|noun|1|فم|Open your mouth, please.|افتح ثمك لو سمحت.
TOOTH|noun|2|سن|I have a bad tooth.|عندي سن بوجعني.
HOTEL|noun|1|فندق|Our hotel is near the sea.|فندقنا قريب من البحر.
TABLE|noun|1|طاولة|Put the plates on the table.|حط الصحون عالطاولة.
SHIRT|noun|1|قميص|He wears a white shirt.|لابس قميص أبيض.
DRESS|noun|1|فستان|She bought a new dress.|اشترت فستان جديد.
FRUIT|noun|1|فاكهة|Fruit is good for you.|الفواكه منيحة إلك.
TRUCK|noun|2|شاحنة|A big truck is on the road.|في شاحنة كبيرة عالطريق.
PLANE|noun|1|طائرة|The plane lands at six.|الطيارة بتنزل الساعة ستة.
SPORT|noun|1|رياضة|Football is my favourite sport.|كرة القدم رياضتي المفضلة.
WORLD|noun|1|عالم|I want to travel the world.|بدي ألف العالم.
PEACE|noun|2|سلام|We all want peace.|كلنا بدنا سلام.
DREAM|noun|2|حلم|I had a strange dream.|حلمت حلم غريب.
LEARN|verb|1|يتعلم|I learn English every day.|بتعلم إنجليزي كل يوم.
WRITE|verb|1|يكتب|Write your name here.|اكتب اسمك هون.
THINK|verb|1|يفكر|Let me think about it.|خليني أفكر فيها.
DANCE|verb|1|يرقص|They dance at the wedding.|بيرقصوا بالعرس.
DRINK|verb|1|يشرب|Drink your tea before it gets cold.|اشرب شايك قبل ما يبرد.
SLEEP|verb|1|ينام|I sleep eight hours a night.|بنام ثماني ساعات بالليل.
STUDY|verb|1|يدرس|She studies at the library.|بتدرس بالمكتبة.
BUILD|verb|2|يبني|They build a new school.|عم يبنوا مدرسة جديدة.
CARRY|verb|2|يحمل|Can you carry this bag?|بتقدر تحمل هالشنطة؟
CATCH|verb|2|يلتقط|Catch the ball!|التقط الطابة!
CLOSE|verb|1|يغلق|Close the window, please.|سكّر الشباك لو سمحت.
COUNT|verb|1|يعدّ|Can you count to ten in English?|بتعرف تعد لعشرة بالإنجليزي؟
LAUGH|verb|1|يضحك|The film made us laugh.|الفيلم ضحّكنا.
SPEAK|verb|1|يتكلم|Do you speak English?|بتحكي إنجليزي؟
SHARE|verb|2|يشارك|Share your food with your friend.|شارك أكلك مع صاحبك.
SMELL|verb|2|يشم|I can smell coffee.|شامم ريحة قهوة.
TEACH|verb|1|يعلّم|She teaches maths.|بتعلّم رياضيات.
TOUCH|verb|2|يلمس|Don't touch the hot pan.|لا تلمس الطنجرة السخنة.
VISIT|verb|1|يزور|We visit our grandmother on Fridays.|بنزور ستّي أيام الجمعة.
PAINT|verb|2|يلوّن|Let's paint the wall yellow.|يلا نلوّن الحيط أصفر.
ENJOY|verb|2|يستمتع|Enjoy your meal!|صحتين!
AGREE|verb|2|يوافق|I agree with you.|أنا موافقك.
SMALL|adj|1|صغير|This shirt is too small.|هالقميص صغير كثير.
WHITE|adj|1|أبيض|Snow is white.|الثلج أبيض.
GREEN|adj|1|أخضر|Her eyes are green.|عيونها خضر.
SWEET|adj|1|حلو المذاق|These dates are very sweet.|هالتمر حلو كثير.
QUIET|adj|1|هادئ|The library is quiet.|المكتبة هادية.
HAPPY|adj|1|سعيد|I am happy to see you.|مبسوط إني شفتك.
ANGRY|adj|1|غاضب|Why are you angry?|ليش زعلان؟
TIRED|adj|1|متعب|I am tired after work.|أنا تعبان بعد الشغل.
EARLY|adj|1|مبكر|I have an early class.|عندي محاضرة بكير.
YOUNG|adj|1|صغير السن|My sister is very young.|أختي صغيرة كثير.
HEAVY|adj|2|ثقيل|This box is heavy.|هالصندوق ثقيل.
EMPTY|adj|2|فارغ|The fridge is empty.|الثلاجة فاضية.
FRESH|adj|2|طازج|I like fresh bread.|بحب الخبز الطازة.
PROUD|adj|2|فخور|I am proud of you.|أنا فخور فيك.
BRAVE|adj|2|شجاع|The firefighter is brave.|الإطفائي شجاع.
SMART|adj|2|ذكي|She is a smart student.|هي طالبة ذكية.
FUNNY|adj|1|مضحك|He tells funny jokes.|بيحكي نكت مضحكة.
LUCKY|adj|2|محظوظ|You are lucky today!|إنت محظوظ اليوم!
BREAD|noun|1|خبز|We buy bread every morning.|بنشتري خبز كل صبح.
PHONE|noun|1|هاتف|My phone is on the table.|تلفوني عالطاولة.
FRIEND|noun|1|صديق|He is my best friend.|هو أعز صاحب إلي.
FAMILY|noun|1|عائلة|I have a big family.|عيلتي كبيرة.
SCHOOL|noun|1|مدرسة|School starts at eight.|المدرسة بتبلّش الساعة ثمانية.
MARKET|noun|1|سوق|We buy vegetables at the market.|بنشتري خضرة من السوق.
ORANGE|noun|1|برتقالة|I want a glass of orange juice.|بدي كاسة عصير برتقال.
BANANA|noun|1|موزة|Monkeys love bananas.|القرود بتحب الموز.
CHEESE|noun|1|جبنة|I eat bread and cheese.|بوكل خبز وجبنة.
COFFEE|noun|1|قهوة|My mother drinks coffee in the morning.|أمي بتشرب قهوة الصبح.
DINNER|noun|1|عشاء|Dinner is ready!|العشا جاهز!
WINDOW|noun|1|نافذة|Look out of the window.|اطّلع من الشباك.
MIRROR|noun|2|مرآة|She looks in the mirror.|بتطّلع بالمراية.
CAMERA|noun|1|كاميرا|My camera takes good photos.|كاميرتي بتصوّر صور حلوة.
BRIDGE|noun|2|جسر|We walk across the bridge.|بنقطع الجسر مشي.
ISLAND|noun|2|جزيرة|They live on a small island.|ساكنين بجزيرة صغيرة.
FOREST|noun|2|غابة|Many animals live in the forest.|في حيوانات كثير بتعيش بالغابة.
DESERT|noun|2|صحراء|It is hot in the desert.|الجو شوب بالصحرا.
FLOWER|noun|1|زهرة|She gave me a red flower.|أعطتني وردة حمرا.
RABBIT|noun|1|أرنب|The rabbit eats carrots.|الأرنب بوكل جزر.
MONKEY|noun|1|قرد|The monkey climbs the tree.|القرد بيطلع عالشجرة.
DOCTOR|noun|1|طبيب|You should see a doctor.|لازم تروح عند الدكتور.
PLAYER|noun|2|لاعب|He is a football player.|هو لاعب كرة قدم.
SINGER|noun|2|مغني|She is a famous singer.|هي مغنية مشهورة.
ARTIST|noun|2|فنان|The artist paints the sea.|الفنان بيرسم البحر.
FATHER|noun|1|أب|My father works in a bank.|أبوي بشتغل ببنك.
MOTHER|noun|1|أم|My mother is a teacher.|أمي معلمة.
SISTER|noun|1|أخت|My sister is ten years old.|أختي عمرها عشر سنين.
PEOPLE|noun|1|ناس|Many people live in this city.|في ناس كثير ساكنين بهالمدينة.
ANSWER|noun|1|إجابة|Write the answer in the box.|اكتب الإجابة بالمربع.
LISTEN|verb|1|يستمع|Listen to the teacher.|اسمع للأستاذ.
TRAVEL|verb|1|يسافر|I want to travel to Japan.|بدي أسافر على اليابان.
FINISH|verb|1|ينهي|Finish your homework first.|خلّص واجبك أول.
FOLLOW|verb|2|يتبع|Follow me, please.|الحقني لو سمحت.
CHANGE|verb|2|يغيّر|I want to change my phone.|بدي أغيّر تلفوني.
ALWAYS|adv|1|دائماً|I always drink tea in the morning.|دايماً بشرب شاي الصبح.
BEFORE|prep|1|قبل|Wash your hands before you eat.|اغسل إيديك قبل ما توكل.
SUMMER|noun|1|صيف|We go to the sea in summer.|بنروح عالبحر بالصيف.
WINTER|noun|1|شتاء|It snows in winter.|بتثلج بالشتا.
AUTUMN|noun|1|خريف|Leaves fall in autumn.|الورق بيوقع بالخريف.
SPRING|noun|1|ربيع|Flowers open in spring.|الورد بيفتّح بالربيع.
MINUTE|noun|1|دقيقة|Wait a minute, please.|استنى دقيقة لو سمحت.
ANIMAL|noun|1|حيوان|What is your favourite animal?|شو حيوانك المفضل؟
NUMBER|noun|1|رقم|What is your phone number?|شو رقم تلفونك؟
LETTER|noun|1|حرف (من الأبجدية)|A is the first letter.|A أول حرف.
PENCIL|noun|1|قلم رصاص|Can I borrow your pencil?|بقدر أستعير قلم الرصاص تبعك؟
PLANET|noun|2|كوكب|Earth is our planet.|الأرض كوكبنا.
SILVER|noun|2|فضة|This spoon is made of silver.|هالمعلقة من فضة.
YELLOW|adj|1|أصفر|The sun is yellow.|الشمس صفرا.
PURPLE|adj|1|بنفسجي|I like your purple scarf.|بتعجبني لفحتك البنفسجية.
STRONG|adj|1|قوي|He is very strong.|هو قوي كثير.
GENTLE|adj|2|رقيق|Be gentle with the baby.|كون رقيق مع البيبي.
BRIGHT|adj|2|ساطع|The sun is bright today.|الشمس ساطعة اليوم.
SIMPLE|adj|2|بسيط|The rules are simple.|القواعد بسيطة.
FAMOUS|adj|2|مشهور|He is a famous actor.|هو ممثل مشهور.
NARROW|adj|2|ضيق|The street is very narrow.|الشارع ضيق كثير.
SCARED|adj|2|خائف|My little brother is scared of dogs.|أخوي الصغير خايف من الكلاب.
WRITER|noun|2|كاتب|She wants to be a writer.|بدها تصير كاتبة.
DRIVER|noun|2|سائق|The bus driver is friendly.|سواق الباص لطيف.
FARMER|noun|2|مزارع|The farmer grows tomatoes.|المزارع بيزرع بندورة.
HONEST|adj|2|صادق|Be honest with me.|كون صادق معي.
BROTHER|noun|1|أخ|My brother plays football.|أخوي بيلعب كرة قدم.
TEACHER|noun|1|معلّم|Our teacher is very kind.|معلمنا طيب كثير.
MORNING|noun|1|صباح|I run every morning.|بركض كل صبح.
PICTURE|noun|1|صورة|Look at this picture.|اطّلع على هالصورة.
EXAMPLE|noun|1|مثال|Can you give me an example?|بتقدر تعطيني مثال؟
COUNTRY|noun|1|بلد|Jordan is a beautiful country.|الأردن بلد حلو.
ENGLISH|noun|1|اللغة الإنجليزية|I speak a little English.|بحكي شوية إنجليزي.
STUDENT|noun|1|طالب|He is a university student.|هو طالب جامعة.
WEATHER|noun|1|طقس|The weather is nice today.|الجو حلو اليوم.
KITCHEN|noun|1|مطبخ|Mum is in the kitchen.|ماما بالمطبخ.
SCIENCE|noun|2|علوم|Science is my favourite subject.|العلوم مادتي المفضلة.
HISTORY|noun|2|تاريخ|We study the history of Jordan.|بندرس تاريخ الأردن.
FREEDOM|noun|3|حرية|Everyone wants freedom.|كل الناس بدها حرية.
LIBRARY|noun|1|مكتبة|I borrow books from the library.|باستعير كتب من المكتبة.
HOLIDAY|noun|1|عطلة|We are on holiday next week.|عنا عطلة الأسبوع الجاي.
CHICKEN|noun|1|دجاج|We have chicken for dinner.|عنا جاج عالعشا.
DOLPHIN|noun|2|دلفين|The dolphin jumps out of the water.|الدلفين بينط من المي.
GIRAFFE|noun|2|زرافة|A giraffe has a long neck.|الزرافة إلها رقبة طويلة.
PENGUIN|noun|2|بطريق|Penguins cannot fly.|البطريق ما بيطير.
MESSAGE|noun|1|رسالة|I got your message.|وصلتني رسالتك.
JOURNEY|noun|2|رحلة|The journey takes three hours.|الرحلة بتاخد ثلاث ساعات.
VILLAGE|noun|2|قرية|My grandparents live in a village.|ستّي وسيدي ساكنين بقرية.
BEDROOM|noun|1|غرفة نوم|My bedroom is upstairs.|غرفة نومي فوق.
BICYCLE|noun|1|دراجة هوائية|I ride my bicycle to school.|بروح عالمدرسة عالبسكليت.
DENTIST|noun|2|طبيب أسنان|I go to the dentist twice a year.|بروح عند دكتور الأسنان مرتين بالسنة.
CAPTAIN|noun|2|قبطان|The captain is on the ship.|القبطان عالسفينة.
PAINTER|noun|2|رسّام|The painter sells his pictures.|الرسام بيبيع لوحاته.
HUNDRED|noun|2|مئة|There are a hundred students.|في مية طالب.
HEALTHY|adj|2|صحي|Fruit is healthy food.|الفاكهة أكل صحي.
EXPLAIN|verb|2|يشرح|Can you explain this word?|بتقدر تشرحلي هالكلمة؟
IMAGINE|verb|3|يتخيّل|Imagine a world without music.|تخيّل عالم بدون موسيقى.
PROMISE|noun|2|وعد|I keep my promise.|أنا بوفي بوعدي.
PROBLEM|noun|1|مشكلة|There is a problem with my car.|في مشكلة بسيارتي.
BETWEEN|prep|2|بين|Sit between your friends.|اقعد بين صحابك.
TONIGHT|adv|1|الليلة|What are you doing tonight?|شو بتعمل الليلة؟
FOREVER|adv|3|إلى الأبد|I will remember this forever.|رح أتذكر هاد للأبد.
PERFECT|adj|2|مثالي|Your English is perfect!|إنجليزيتك ممتازة!
SPECIAL|adj|2|مميز|Today is a special day.|اليوم يوم مميز.
CORRECT|adj|1|صحيح|Your answer is correct.|جوابك صحيح.
CAREFUL|adj|2|حذر|Be careful on the road.|انتبه عالطريق.
`;

export const LEXICON: Entry[] = RAW.trim()
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

export const BY_WORD: ReadonlyMap<string, Entry> = new Map(LEXICON.map((e) => [e.word, e]));

/**
 * Common English words that are not puzzle words, so a player who traces one hears "a real word,
 * but not one of this puzzle's" instead of "not a word".
 */
export const EXTRA_WORDS: readonly string[] = (
  "THE AND YOU ARE FOR NOT BUT HAD HAS HER HIS HOW MAN NEW NOW OLD SEE TWO WAY WHO BOY DID ITS LET PUT SAY SHE TOO USE " +
  "CAT DOG SUN SEA CAR BUS BED BOX CUP EGG HAT LEG ARM EAR EYE PEN RED TEA TEN TOY WIN YES BIG HOT RUN SIT EAT " +
  "THAT WITH HAVE THIS WILL YOUR FROM THEY BEEN MANY SOME THEM THAN THEN WHAT WHEN TELL VERY JUST LIKE OVER ALSO " +
  "BACK ONLY COME MADE MAKE MOST MUCH MUST SAID SAME WANT WELL WERE HERE ROSE HOLE HOLD SOLE TOLE NOTE TONE LONE " +
  "LINE LION LOAN SEAT TEAR RATE TALE LATE MEAT MATE TEAM BEAR BEAT HEAT HEAR HATE HOSE SHOE TOES NEST REST TEST " +
  "THERE THEIR WHICH ABOUT WOULD THESE OTHER COULD FIRST AFTER WHERE THOSE WHILE THREE STONE STORE START STATE " +
  "TOTAL OTHER NORTH SOUTH SHORT THOSE EARTH HEART HATER LATER WATER TIMER RINSE SNORE SHORE ALONE ATONE"
)
  .split(" ")
  .filter(Boolean);
