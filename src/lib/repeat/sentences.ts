// Repeat: the sentences the game says and the learner repeats. Short, everyday English, from
// two to six words, each with its Arabic meaning. A round takes ten at random.

export type RepeatSentence = { en: string; ar: string };

export const ROUND_SIZE = 10;

export const SENTENCES: readonly RepeatSentence[] = [
  { en: "I like honey", ar: "أحب العسل." },
  { en: "I need change", ar: "أحتاج فكة." },
  { en: "My heart hurts", ar: "قلبي يؤلمني." },
  { en: "Actually, I'm fine", ar: "في الواقع، أنا بخير." },
  { en: "I live alone", ar: "أعيش وحدي." },
  { en: "Let's play a game", ar: "لنلعب لعبة." },
  { en: "May I listen?", ar: "هل يمكنني الاستماع؟" },
  { en: "The captain is here", ar: "القبطان هنا." },
  { en: "The battery is dead", ar: "نفدت بطارية الجهاز." },
  { en: "Be kind", ar: "كن لطيفًا." },
  { en: "Good morning", ar: "صباح الخير." },
  { en: "See you tomorrow", ar: "أراك غدًا." },
  { en: "I'm very hungry", ar: "أنا جائع جدًا." },
  { en: "Where is the station?", ar: "أين المحطة؟" },
  { en: "Can you help me?", ar: "هل يمكنك مساعدتي؟" },
  { en: "I don't understand", ar: "لا أفهم." },
  { en: "Please speak slowly", ar: "من فضلك تكلم ببطء." },
  { en: "What time is it?", ar: "كم الساعة؟" },
  { en: "I'm a student", ar: "أنا طالب." },
  { en: "The coffee is hot", ar: "القهوة ساخنة." },
  { en: "Open the window", ar: "افتح النافذة." },
  { en: "Close the door", ar: "أغلق الباب." },
  { en: "I'm running late", ar: "أنا متأخر." },
  { en: "It's raining outside", ar: "إنها تمطر في الخارج." },
  { en: "How much is this?", ar: "بكم هذا؟" },
  { en: "I love this song", ar: "أحب هذه الأغنية." },
  { en: "We are friends", ar: "نحن أصدقاء." },
  { en: "She is my sister", ar: "هي أختي." },
  { en: "He works at night", ar: "هو يعمل في الليل." },
  { en: "The food is delicious", ar: "الطعام لذيذ." },
  { en: "I feel tired today", ar: "أشعر بالتعب اليوم." },
  { en: "Turn left here", ar: "انعطف يسارًا هنا." },
  { en: "Call me later", ar: "اتصل بي لاحقًا." },
  { en: "I forgot my keys", ar: "نسيت مفاتيحي." },
  { en: "Let's go home", ar: "لنذهب إلى البيت." },
  { en: "The shop is closed", ar: "المتجر مغلق." },
  { en: "Is this seat free?", ar: "هل هذا المقعد شاغر؟" },
  { en: "I want some water", ar: "أريد بعض الماء." },
  { en: "Thank you so much", ar: "شكرًا جزيلًا." },
  { en: "Nice to meet you", ar: "سررت بلقائك." },
  { en: "I'm learning English", ar: "أنا أتعلم الإنجليزية." },
  { en: "Wait for me", ar: "انتظرني." },
  { en: "The bus is late", ar: "الحافلة متأخرة." },
  { en: "I have a question", ar: "لدي سؤال." },
  { en: "Don't worry about it", ar: "لا تقلق بشأن ذلك." },
  { en: "My phone is broken", ar: "هاتفي معطل." },
  { en: "I'll be right back", ar: "سأعود حالًا." },
  { en: "Take your time", ar: "خذ وقتك." },
  { en: "It was a long day", ar: "كان يومًا طويلًا." },
  { en: "I agree with you", ar: "أنا أتفق معك." },
  { en: "The room is clean", ar: "الغرفة نظيفة." },
  { en: "Where do you live?", ar: "أين تعيش؟" },
  { en: "I'm from Jordan", ar: "أنا من الأردن." },
  { en: "The sky is blue", ar: "السماء زرقاء." },
  { en: "Happy birthday", ar: "عيد ميلاد سعيد." },
  { en: "Drive safely", ar: "قد بأمان." },
  { en: "I miss my family", ar: "أشتاق لعائلتي." },
  { en: "This is my friend", ar: "هذا صديقي." },
  { en: "The test was easy", ar: "كان الاختبار سهلًا." },
  { en: "I need a doctor", ar: "أحتاج طبيبًا." },
  { en: "Keep the change", ar: "احتفظ بالباقي." },
  { en: "Let me think", ar: "دعني أفكر." },
  { en: "Sorry, I'm busy", ar: "آسف، أنا مشغول." },
  { en: "The water is cold", ar: "الماء بارد." },
  { en: "Do you speak English?", ar: "هل تتكلم الإنجليزية؟" },
  { en: "I'm ready to go", ar: "أنا جاهز للذهاب." },
  { en: "The movie starts soon", ar: "سيبدأ الفيلم قريبًا." },
  { en: "Have a nice day", ar: "أتمنى لك يومًا سعيدًا." },
  { en: "I can't find it", ar: "لا أستطيع إيجاده." },
  { en: "The cat is sleeping", ar: "القطة نائمة." },
  { en: "Please sit down", ar: "تفضل بالجلوس." },
  { en: "We are almost there", ar: "اقتربنا من الوصول." },
  { en: "I like your shoes", ar: "أعجبني حذاؤك." },
  { en: "It's too expensive", ar: "إنه غالٍ جدًا." },
  { en: "Practice makes perfect", ar: "التمرين يصنع الإتقان." },
  { en: "I'm proud of you", ar: "أنا فخور بك." },
  { en: "Let's start again", ar: "لنبدأ من جديد." },
  { en: "The baby is crying", ar: "الطفل يبكي." },
  { en: "Turn off the lights", ar: "أطفئ الأنوار." },
  { en: "Good luck tomorrow", ar: "حظًا موفقًا غدًا." },
];

/** Ten different sentences in a random order (`random` is for tests). */
export function pickRound(
  count = ROUND_SIZE,
  random: () => number = Math.random,
  pool: readonly RepeatSentence[] = SENTENCES,
): RepeatSentence[] {
  const list = [...pool];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, Math.min(count, list.length));
}
