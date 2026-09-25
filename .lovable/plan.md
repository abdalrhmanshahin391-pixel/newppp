# تسريع Rita وإكمال خطة Rita Economic v2

قرأت الوثيقة كاملة (18 صفحة) وتتبعت الكود الحالي خطوة بخطوة: الميكروفون ← Deepgram ← GPT-4o mini ← صوت OpenAI.
البنية نفسها صحيحة ومطابقة للوثيقة. البطء سببه تفاصيل صغيرة في طريقة التنفيذ، وليس الخدمات نفسها.
الخطة تلتزم بقائمة "لا تضف" في الوثيقة: بدون LiveKit، بدون ElevenLabs، بدون صوت تخميني مسبق، وبدون إرسال النص الجزئي إلى GPT.

## ليش النص يطلع قبل الصوت (أسباب مؤكدة من الكود)

1. **Rita تستنى جملة طويلة قبل ما تبدأ الصوت.** أول مقطع صوتي لا يُرسل إلا بعد 8 كلمات على الأقل مع نقطة أو علامة سؤال، أو بعد 18 كلمة. النص بيظهر على الشاشة كلمة كلمة، والصوت ما بيبدأ إلا بعد هيك. هذا أكبر سبب للفجوة.
2. **كل مقطع صوتي بيعيد التحقق من كل شي من الصفر.** طلب الصوت بيتحقق من تسجيل الدخول، وبيقرأ الإعدادات، وبيقرأ مفتاح OpenAI من قاعدة البيانات، بالتسلسل، وقبل ما يطلب الصوت من OpenAI. هذا تقريباً 200–500 ملي ثانية ضايعة على كل مقطع.
3. **نفس المشكلة قبل ما يبدأ الجواب.** قبل ما GPT يبدأ يكتب، السيرفر بيعمل تقريباً 6 استعلامات لقاعدة البيانات واحد ورا الثاني (تسجيل الدخول، الإعدادات، الخطة، الاستهلاك، المفتاح).
4. **الحشوات ("مم…"، "فهمت عليك…") بتتولّد أول مرة على كل جهاز.** هيك بتتأخر ولها تكلفة. المفروض تكون ملفات جاهزة، والوثيقة بتطلب هذا صراحة.
5. **حد الرد 55 كلمة.** الوثيقة بتطلب 40.

## الأشياء المجانية من الوثيقة وغير المطبقة حالياً (تأكدت منها)

- إعادة اتصال Deepgram تلقائياً بعد الانقطاع (250 ثم 750 ثم 1500 ملي ثانية)، بتصريح جديد لكل محاولة. حالياً الانقطاع بيظهر خطأ وبس.
- إغلاق اتصال Deepgram بعد دقيقتين بدون كلام، وفتحه تلقائياً أول ما المستخدم يحكي. هذا بيوفر في التكلفة.
- حشوات جاهزة بصوتي marin و cedar، وتحميلها مسبقاً عند بداية الدرس.
- تعديل حد الرد إلى 40 كلمة.
- عدّاد لإعادة الاتصال، ونسبة أعطال كل مرحلة، وتسجيل الأدوار الفاشلة حتى لو ما بدأ الصوت، وحساب مدة الصوت الحقيقية بدل التقدير من عدد الكلمات.
- إشارة "صوت مولّد بالذكاء الاصطناعي" في صفحة Rita.

## ما سأنفذه

### أ. سد الفجوة بين النص والصوت (الأهم)
- أول مقطع صوتي يُرسل أبكر: بعد 4 كلمات تقريباً عند أي فاصلة أو نقطة، أو بعد 10 كلمات كحد أقصى. المقاطع اللي بعده تبقى طبيعية الطول (8–18 كلمة) حتى ما يصير الصوت متقطعاً. هذا ليس صوتاً تخمينياً، لأنه نص نهائي من GPT.
- الصوت يتجهز قبل أن يظهر النص على الشاشة، مش بعده.
- الهدف: يبدأ الصوت خلال 300–600 ملي ثانية تقريباً من ظهور أول كلمة.

### ب. تسريع السيرفر
- إعدادات Rita ومفاتيحها تنحفظ في ذاكرة مؤقتة لمدة 60 ثانية، بدل قراءتها من قاعدة البيانات في كل طلب.
- طلب الصوت يعتمد على "تذكرة الصوت" الموقّعة، اللي أصلاً مربوطة بالمستخدم والدور ونص المقطع. هيك ما بنحتاج نتحقق من تسجيل الدخول من جديد لكل مقطع، والحماية تبقى نفسها.
- الاستعلامات اللي قبل الجواب تشتغل مع بعض في نفس الوقت بدل واحد ورا الثاني.
- الاتصال بـ OpenAI يُفتح مسبقاً عند بداية الدرس.

### ج. الحشوات
- توليد الحشوات التسعة (3 لغات × 3 عبارات) لكل صوت مرة واحدة فقط، وحفظها داخل الموقع.
- تحميل حشوات لغة الدرس مسبقاً عند الضغط على بدء الدرس.
- قواعد الوثيقة كما هي: 650 ملي ثانية انتظار، حشوة واحدة لكل دور، وما بتتكرر نفس العبارة مرتين ورا بعض.

### د. الثبات
- مدير اتصال لـ Deepgram فيه إعادة اتصال تلقائية، وإنقاذ الجملة الحالية فقط عبر OpenAI Transcribe، وبدون أي تحويل تلقائي إلى Legacy.
- إغلاق الاتصال بعد دقيقتين بدون كلام، وإعادة فتحه عند الكلام، مع إرسال الكلمات المهمة من جديد.
- عبارة "احكي إنجليزي/عربي/ألماني" تتطبق من الدور اللي بعده مباشرة.

### هـ. القياس ولوحة الإدارة
- حفظ عدد مرات إعادة الاتصال، ونسبة استخدام البديل، وأخطاء كل مرحلة (التفريغ، الجواب، الصوت)، ومدة الصوت الفعلية.
- تسجيل الأدوار الفاشلة.
- عرض كل هذا مع p50 و p95 في لوحة الإدارة.
- القياسات ما بتظهر للمستخدم أبداً على أنها فشل في الرد.

### و. الاختبار
- اختبارات للتقطيع الجديد، وللذاكرة المؤقتة، وللتذكرة، ولإعادة الاتصال.
- بعدها فحص البناء الكامل للموقع.

## شرط لازم منك

**Rita لن تعمل على قاعدة البيانات الجديدة قبل إضافة مفتاحي OpenAI و Deepgram.**
التأكد من الكود كان من خلال القراءة فقط. التجربة الصوتية الحقيقية من بدايتها لنهايتها تحتاج المفتاحين.
بعد التنفيذ رح أطلبهم منك بنموذج آمن، أو بتقدر تضيفهم بنفسك من لوحة الإدارة ← Rita API Keys.

**بخصوص النموذج:** أنا ما بقدر أختار النموذج اللي بشتغل فيه. بس الخطة مبنية على قراءة كاملة للكود، وكل سبب فيها مؤكد من الملفات نفسها.

## التفاصيل التقنية

- `src/lib/rita-clause-chunker.ts`: first-segment policy (min 4 words at `[,،.!?؟؛:]`, hard cap 10 words), later segments unchanged (8/18), total segments stays ≤3 (ticket index 0–2 unchanged).
- `src/routes/api/rita/respond.ts`: emit `speech.segment` before `reply.delta` for the same chunk; run settings + key + allowance with `Promise.all`; responseWords default 40 (`rita-voice.server.ts` DEFAULT + DB row update).
- `src/lib/rita-voice.server.ts`: module-level TTL cache (60s) for `getRitaSettings`, `resolveRitaOpenAiKey`, `resolveRitaDeepgramKey`; invalidate when the admin saves keys or settings.
- `src/routes/api/rita/speech.ts`: authorize with the HMAC ticket only (add a short expiry to the ticket payload), skip `requireRitaUser`; use cached settings and key.
- Fillers: a one-time admin-triggered server function generates PCM files and stores them in the private `site-media` bucket under `rita-fillers/{voice}/{lang}-{i}.pcm`. The client preloads them through signed URLs at lesson start and keeps the Cache API. `/api/rita/filler` serves the stored copy and generates only on a cache miss.
- `src/lib/rita-economic.client.ts`: a connection manager with backoff (250/750/1500ms) that requests a fresh `/api/rita/deepgram-token` on each reconnect and re-sends keyterms; buffered `turnAudio` goes to `onFallback` only for the in-flight utterance; a 120s idle close with lazy reopen on local VAD speech start (the pre-roll covers reconnect latency).
- Metrics: add columns to `rita_turn_metrics` (reconnect_count, stt_error, gpt_error, tts_error, actual_output_audio_ms, failed) via migration; the client sums real PCM bytes (bytes/48000 s); the admin panel adds these to its aggregates.
- Tests: extend `rita-clause-chunker.test.ts`, `rita-speech-ticket.server.test.ts`; new tests for cache TTL and reconnect backoff; run `bunx vitest run` and a production build.

**do u want to apply it like lovable**
