# إصلاح Rita: رجوع الصوت، وتسريع حقيقي

## شو اللي صار (مؤكد من سجلات موقعك الحي والكود)

- **آخر درس ناجح كان الساعة 8:30 بتوقيتك** (3 ردود مسجلة). من بعد تعديلاتي **ولا رد واحد اكتمل**.
- في تجربتك الأخيرة على newppp.lovable.app: الجواب بدأ، وطلبين صوت انبعثوا، و**الاثنين انقطعوا قبل ما يوصلوا**. بعدها اشتغل "إنقاذ الجملة" عن طريق OpenAI، وانعاد تشغيل الدرس.
- **السبب الرئيسي:** أي صوت بسيط يلتقطه الميكروفون (ضجة، أو صدى صوت Rita نفسها، أو "مم…") بيعتبره كلام منك. وفوراً **بيلغي الجواب والصوت كله**. هذا كان موجود قبل، بس تعديلي خلّى الحشوة ("مم…") جاهزة وتشتغل بعد 650 ملي ثانية بالضبط. هيك صار الميكروفون يسمعها ويقطع Rita بكل دور تقريباً. هذا يفسر "ما بسمع صوت".
- **خطأ ثاني عملته:** بعد دقيقتين سكوت الاتصال بيتسكر. وأول ما ترجع تحكي، **أول نص ثانية من كلامك بتضيع** لأنه ما في مكان يستنى فيه الصوت لحتى يرجع الاتصال. هيك Rita "ما بتسمع" أول كلامك، وبعدها بتلجأ للإنقاذ البطيء (هذا بيوصل لـ9 ثواني).
- **البطء الأساسي كان موجود قبل تعديلي:** من نهاية كلامك لأول صوت 3–4.5 ثانية. منها تقريباً ثانيتين بين النص وأول كلمة من GPT، وهذا كثير جداً.

## الإصلاح

### 1. رجوع الصوت فوراً (الأولوية)
- **المقاطعة ما بتصير إلا بكلام حقيقي.** بدل ما أي ضجة تلغي الرد، Rita بتوقف بس لما Deepgram يطلع كلمتين حقيقيتين على الأقل منك، أو لما تحكي أكثر من 400 ملي ثانية متواصلة. هيك بتشتغل Pipecat والشركات الكبيرة: بستنوا عدد أدنى من الكلمات قبل ما يعتبروا الكلام مقاطعة [2](https://docs.pipecat.ai/pipecat/learn/speech-input).
- **وهي "بتفكر" ما بينلغى الجواب** بسبب ضجة. بينلغى بس إذا فعلاً بلشت جملة جديدة.
- **الحشوة ما بتشغّل كاشف الكلام.** وقت ما "مم…" شغالة، الميكروفون بيعاملها كصوت Rita مش كصوتك.
- **إصلاح إعادة فتح الاتصال:** الصوت بيتخزن لحتى يرجع الاتصال، وما في ولا كلمة بتضيع. التصريح الجديد بينطلب مسبقاً قبل ما ينتهي القديم، مش بعد ما تحكي.
- إذا الاتصال فشل 3 مرات، بتطلعلك رسالة واضحة بدل السكوت.

### 2. تسريع حقيقي (من خبرة Deepgram وPipecat)
- **نهاية الكلام أسرع:** حالياً Rita بتستنى لحد 1.5 ثانية سكوت قبل الإنقاذ. رح أعتمد على إشارة "انتهى الكلام" من Deepgram مباشرة (endpointing ≈300ms و utterance_end)، وأخلي الإنقاذ بس لما Deepgram فعلاً يفشل. حسب Deepgram، التأخير بالتفريغ سببه انتظار نهاية الكلام مش المعالجة [6](https://deepgram.com/learn/voice-agent-architecture-stt-llm-tts-pipeline-design).
- **ثانيتين قبل أول كلمة من GPT:** رح أقيس كل خطوة جوّا السيرفر (تسجيل الدخول، الرصيد، البرومبت، أول حرف من OpenAI)، وأبعثها مع الرد. بعدها بشيل اللي بطيء. بالغالب البرومبت طويل والسجل كبير، فرح أثبّت بداية البرومبت حتى يشتغل الـcache عند OpenAI، وأقصّر السجل لآخر 6 رسائل.
- **الصوت يبدأ أبكر:** أول مقطع صوتي بيطلع من أول 4 كلمات (هذا مطبق وشغال). رح أتأكد إنه أول طلب صوت بيطلع فعلاً خلال أقل من ثانية من بداية الرد.
- **هدف واقعي:** من نهاية كلامك لأول صوت ≈ 1.2–1.8 ثانية بدل 3–4.5. Deepgram بتقول إنه الناس بيلاحظوا التأخير من حوالي 800 ملي ثانية [6](https://deepgram.com/learn/voice-agent-architecture-stt-llm-tts-pipeline-design).

### 3. قياس بتشوفه بعينك
- كل دور بينحفظ، **حتى الفاشل**: وين انقطع (تفريغ، GPT، صوت)، وليش (مقاطعة، خطأ، انقطاع اتصال).
- بلوحة الأدمن: جدول آخر 20 دور، ووقت كل مرحلة، وp50/p95. هيك بنعرف بالأرقام إذا صار أسرع، بدل التخمين.

### 4. التحقق قبل ما أقلك "خلص"
- اختبارات تلقائية للمقاطعة، ولإعادة الاتصال بدون ضياع صوت، وللتقطيع.
- تجربة حقيقية على السيرفر: أبعث جملة لـ respond وspeech بمفاتيحك الموجودة، وأتأكد إنه الصوت بيرجع كامل وبقيس الوقت.
- نشر الموقع من جديد. بعدها بطلب منك تجرب درس واحد، وأنا بقرأ الأرقام من السجل.

## ما رح أضيفه (حسب ملف الخطة)
بدون LiveKit، ElevenLabs، صوت تخميني، أو تغيير المزوّدين. Deepgram Flux وخدمة الصوت من Deepgram أسرع، بس الملف ما طلبهم. إذا بدك، بنجربهم بعدين كخطوة منفصلة.

## التفاصيل التقنية
- `rita-economic.client.ts`: `onSpeechStart` no longer triggers barge-in by itself. Add `onBargeIn`, fired on the first Deepgram interim with ≥2 words OR ≥400 ms continuous VAD speech while output is active. `rita-live.tsx` moves `stopSpeaking()` + `turnAbort.abort()` from `onSpeechStart` to `onBargeIn`; while processing without output, abort only on a confirmed interim.
- Filler playback calls `setOutputSpeaking(true)` before `replay` (the higher 3.2×/10-frame threshold).
- Idle reopen: create the socket synchronously with the current token (pre-refreshed every ~4 min in the background), buffer audio in a manager-level queue until OPEN, and flush preRoll into it. Fix the single shared `reconnectTimer` so each language gets its own.
- Deepgram URL: `endpointing=300&utterance_end_ms=1000&interim_results=true&vad_events=true`; finalize on `speech_final`/`UtteranceEnd`. The `recoverTurn` quiet timeout goes 1500 → 2500 ms and fires only when no `is_final` has arrived.
- `respond.ts`: Server-Timing marks auth/allowance/prompt/openai_ttfb, forwarded via the `turn.started` SSE. Static system prefix first (prompt caching), history capped at 6.
- Metrics: always submit on failure/abort, with an `error_stage` + `abort_reason` column (migration). Admin panel gets a last-20-turns table + p50/p95.
- Tests: barge-in gating, idle reopen with no audio loss, and the chunker. A live server check calls `/api/rita/respond` + `/api/rita/speech` with the stored keys and records timings. Then republish.

**do u want to apply it like lovable**
