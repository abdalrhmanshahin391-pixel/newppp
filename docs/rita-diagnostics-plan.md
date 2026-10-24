# خطة تشخيص ريتا وتحسينها مع الوقت (المرجع الثابت)

> هاد الملف هو الذاكرة الثابتة للشغل. أي جلسة جديدة تقرأه أول.
> المصادر: فكرة صاحب المشروع (محلّل آلي بيجمّع المشاكل)، وبحث Perplexity
> «خطة تشخيص واختبار ريتا» (الصندوق الأسود)، وخطة Hamza «خطة جعل ريتا أفضل مع الوقت»
> (مبنية على الكود عند `69da1bf`)، وتحقق Claude من الكود على `main` بتاريخ 24 أكتوبر 2026.

## 1. طلبات صاحب المشروع (ما تتغير)

1. **كل محادثة مع ريتا إلها سجل تصليح لحالها**: دفاتر أدوارها، وبلاغاته فيها، وتحليل المحلّل
   إلها، والنسخة اللي اشتغلت عليها. ينزل كملف واحد لهاي المحادثة (زر «ملف التصليح»).
2. **المحلّل الآلي يستخدم مفتاح OpenAI الموجود**: `resolveRitaOpenAiKey()` في
   `src/lib/rita-voice.server.ts` بيقرأ `admin_ai_keys` (provider=openai, purpose `rita` ثم
   `shared`, slot 1) من صفحة `/admin/ai-keys`، وإلا `OPENAI_API_KEY` من بيئة السيرفر. ما في
   مكان جديد للمفتاح. إذا ما في مفتاح: المحلّل يوقف بهدوء ويبين رسالة «حط مفتاح OpenAI
   بـ/admin/ai-keys»، والمكالمات ما تتأثر. المفتاح ما يوصل للمتصفح ولا للـworker الصوتي.
3. المشاكل تتجمع وتوصل Claude كملف جاهز للإصلاح، بدل إرسال PDF كامل كل مرة.
4. ما ينبطأ المنتج.
5. بروتوكول AGENTS.md: خطة أولاً، والتنفيذ بعد الموافقة، وتغييرات الواجهة بـDesign Brief.

## 2. المبادئ الثابتة (من الملفين)

1. **مسار الصوت ما يتلمس**: داخل المكالمة لا نموذج إضافي، لا كتابة قاعدة بيانات من الـworker،
   لا `await` لسجلات، لا طلب شبكة لكل حدث، لا طابور بلا حد.
2. **التحليل بعد المكالمة فقط**. الفحوص الحتمية قبل النموذج. لا تقييم بنموذج قبل كل جواب.
3. **بلاغ المستخدم هو الحقيقة**؛ المحلّل الآلي فرز وليس حكماً. المحلّل يقرأ النص فقط (لا يحكم
   على النطق/الصوت)، وأي «خطأ قاعدة ألمانية» منه لا يُعتمد قبل مراجعة إنسان وتحويله لقاعدة في
   `rita_content_probe.py`. حقل `suspected_layer` فرضية للتوجيه، مش سبب مثبت.
4. **إصلاح واحد لكل PR**، ولا نجمع توقيت + ذاكرة + تعليمات + نموذج في تغيير واحد.
5. **كل مشكلة مؤكدة تصير اختباراً ثابتاً**، ولا تُغلق البطاقة لمجرد دمج تعديل.
6. **لا أسرار ولا صوت ولا نص كامل في السجلات العامة**؛ قائمة سماح للحقول.
7. **أي فقد أحداث يظهر** («السجل غير مكتمل» + عداد فقد)، ما في فقد صامت.
8. **بوابة السرعة PERF-01**: التشخيص مفعّل مقابل معطّل؛ زيادة p95 لأول صوت < 20ms، ولا زيادة
   في المقاطعات الخاطئة. نستعمل الـcanary الصوتي الموجود (#63–#69) للقياس.
9. الـPDF للقراءة؛ مصدر التحقيق JSON قابل لإعادة التشغيل. نص المحادثة بيانات غير موثوقة
   (لا HTML منفّذ).

## 3. حقائق الكود اللي تم التحقق منها (24 أكتوبر، `main` عند `cc04d6a`)

| # | الفجوة | الدليل |
|---|---|---|
| G1 | ما في معرّف دور مشترك | `bot.py` يستعمل `turn_id=latency.turn` (عدّاد)؛ الصفحة `RitaRealtimeV3.tsx` ~992 `turnId.current = crypto.randomUUID()` |
| G2 | سجل نهاية رد ريتا يكتب دائماً «غير مقاطع» | `bot.py` ~660 `interrupted=False`؛ `AssistantTurnStoppedMessage` في Pipecat 0.0.105 فيها `content` و`timestamp` فقط |
| G3 | قرارات نهاية الدور بسجل Modal النصي فقط، وحقولها bound extras ما تظهر | سطور «Rita user turn committed» / «Rita assistant turn committed» |
| G4 | ما في هوية نسخة | لا `RITA_GIT_SHA` في `rita-modal-deploy.yml` ولا `modal_app.py`؛ `model_proof` (start.ts) أسماء النماذج فقط |
| G5 | المتصفح يرسل طلب HTTP لكل حدث | `sendMetric` في `RitaRealtimeV3.tsx`؛ المسار `src/routes/api/rita-v3/session/metrics.ts` يتطلب `Authorization` (`requireRitaUser`) وفيه `ALLOWED_EVENTS` |
| G6 | مهلة الجملة بدون نقطة مقصوصة 0.45/0.65/0.85 | `rita_turn_policy.py: adaptive_unpunctuated_secs` |
| G7 | ما في زر بلاغ ولا جدول بلاغات | لا شيء في `src` ولا `migrations` |
| G8 | المراقب يستقبل كل إطار | `RitaLatencyObserver.on_push_frame`؛ الدفتر لازم يبقى خفيف (فحص نوع ثم خروج) |
| — | مهلة الـ0.9 (period) مش سبب منفصل | داخل `bounded_complete_commit` في `rita_turn_policy.py`؛ الدفتر لازم يفصل `period` |

**أساس موجود نبني عليه (لا نعيد بناءه):**
- جداول `rita_v3_sessions` و`rita_v3_events` (`event_name`, `value_ms`, `metadata jsonb`) — migration `20260927173000`؛ `diagnostic_trace_id` — `20261009090000`.
- `rita_free_conversation_messages` تحفظ `generated_content` و`spoken_content` و`delivery_status` و`client_message_id`.
- `voice-agent/rita_latency.py` (`RitaLatencyRecorder`: `turn`، marks لكل دور: speech_start/end، stt_first_final، llm_first_answer_text، tts_first_bytes، worker_first_audio_frame…)، `rita_state.py` (اللغة ومصدرها، act، response_type، task، phrase)، `rita_turn_policy.py` (`last_stop_reason`)، `rita_groq_llm.py` (`finish_reason`).
- مراقبات Pipecat مستعملة: `UserBotLatencyObserver`, `StartupTimingObserver`, `MetricsLogObserver`, و`enable_turn_tracking=True`.
- استعادة الدور الضايع بعد المقاطعة (#66/#67): سطر «Rita recovering committed turn that missed the router».
- `rita_content_probe.py` (يشتغل بسر Modal بعد #60)، وأرقام `seq` لأحداث الصفحة (#58)، وتصدير المحادثة md/JSON/PDF من `/rita-conversations`.
- نمط الجدولة الموجود: `pg_cron` + `pg_net` يستدعي مسار API في التطبيق (`/api/public/push-dispatch`). **ما في `supabase/functions` بالمشروع.**

## 4. تصحيحات على خطة Hamza (لازم تنطبق)

1. المحلّل **مسار API في التطبيق** (`/api/public/rita-review`) يستدعيه `pg_cron` عبر `pg_net`، محمي بسر في الـheader (مش Edge Function).
2. إرسال آخر دفعة عند إغلاق الصفحة بـ`fetch(..., { keepalive: true })` مع header المصادقة، لأن `sendBeacon` ما يقدر يرسل `Authorization`.
3. الدفتر يفصل سبب `period` عن `bounded` (quick)، ويحط الحقول بنص سطر السجل مش extras.
4. الخصوصية: موافقة «ساعد في تحسين ريتا» (مفعّلة لحساب صاحب المشروع)؛ قرار النص والافتراضي للمتعلمين الآخرين لصاحب المشروع. `store:false` + تنبيه أن OpenAI تحتفظ بسجلات مراقبة الإساءة حتى 30 يوم.

## 5. المراحل بالترتيب (PR مستقل لكل مرحلة)

### المرحلة 0 — خط أساس (بدون كود)
مكالمة بجدول الـ19 جملة (دليل ChatGPT)، مع `conv.md` و`conv.json` وسجلات Modal. المقارنة بالمقاطعة القديمة 38% (29/76).

### المرحلة 1 — دفتر الدور + المعرّف المشترك (worker + صفحة، بدون migration)
- `voice-agent/rita_turn_ledger.py`: سجل بالذاكرة لكل دور، يُملأ من الموجود فقط.
- `turn_ref = f"{session_id}-t-{n}"` مشترك (G1).
- رسالة RTVI واحدة `{type: "rita-turn-ledger", v: 1, ...}` عند انتهاء أو مقاطعة رد ريتا، أقل من 1KB، بلا نص كامل ولا أسرار. الحقول: `turn_ref`, `build`, `prompt_hash`, `stop_reason` (smart|bounded|period|unpunctuated|short_phrase|timeout|force), `wait_ms`, `user_resumed`, `words`, `route`, `act`, `response_type`, `explain_lang` + source, `learn_lang`, `task`, `llm.first_token_ms`, `llm.finish_reason`, `tts.first_audio_ms`, `interrupted`, `interrupt_after_ms`, `recovered_turn`.
- المقاطعة الحقيقية من `InterruptionFrame` (G2).
- `RITA_GIT_SHA` من `rita-modal-deploy.yml` + هاش قصير للتعليمات، في الدفتر وفي `model_proof` (G4).
- حقول سطور السجل بنص الرسالة (G3).
- الصفحة: تستقبل `rita-turn-ledger` وتخزنه حدثاً `turn_ledger` في `rita_v3_events` (إضافة لـ`ALLOWED_EVENTS`)، مع `conversationId` و`userMessageId` و`replyMessageId` — هيك سجل التصليح لكل محادثة بدون migration.
- اختبارات: شكل الدفتر وحجمه، رسالة واحدة لكل دور، صحة علم المقاطعة، لا أسرار، لا عمل إضافي بمسار الصوت.
- القبول: فتح أي فقاعة ومعرفة قرار دورها ونسختها؛ PERF-01.

### المرحلة 2 — أحداث المتصفح بدفعات (G5)
طابور محدود 500 حدث (الأقدم يسقط + عدّاد فقد)، دفعة كل 5 ثواني أو 25 حدث لمسار `/api/rita-v3/session/metrics-batch`، وعند الإخفاء/الإغلاق `fetch keepalive`. `event_id` ضد التكرار + `seq`. القبول: طلبات أقل بوضوح، ولا ضياع عند الإغلاق.

### المرحلة 3 — زر «في مشكلة بهذا الرد» + ملف التصليح لكل محادثة (G7)
- زر جنب كل رد: قاطعني / فهمني غلط / نسي / جوابه غلط / شرحه ناقص / اختفى / غيره + ملاحظة.
- جدول `rita_issue_reports` (RLS: صاحب البلاغ والأدمن) — **migration**.
- زر «ملف التصليح» لكل محادثة في `/rita-conversations`: JSON واحد (الرسائل + دفاتر الأدوار + البلاغات + التحليل + النسخة).
- Design Brief للزر قبل البناء.

### المرحلة 4 — المحلّل بعد الجلسة (فكرة صاحب المشروع)
- `/api/public/rita-review` + `pg_cron` كل دقيقتين، `rita_review_jobs` (pending/running/done/failed).
- طلب واحد لكل جلسة (أو لكل 40 دور)، OpenAI Responses API، `text.format = json_schema, strict: true`، `service_tier: "flex"`، `store: false`، نموذج من `RITA_REVIEW_MODEL`.
- المخرجات لكل دور: `turn_ref`, `verdict` (good|minor|bad), `categories`, `severity` 1..4, `evidence`, `user_goal`, `rita_understood`, `language_ok`, `explain_lang_ok`, `teaching_ok`, `factual_error`, `better_reply`, `suspected_layer` (stt|turn_policy|router|prompt|memory|llm|tts|ui), `suggested_test`, `confidence`.
- الفئات الثابتة ← الاختبارات: premature_turn_end ← TURN-01/02؛ duplicate_or_stale_reply ← TURN-04, INT-03/04؛ ignored_correction ← CTX-01/02؛ wrong_explain_language ← CTX-03؛ task_dropped ← CTX-04/05/06؛ too_short/too_long ← EDU-04؛ not_simplified ← EDU-01؛ factual_error ← EDU-02/03؛ complaint_treated_as_lesson ← BUG-01؛ stt_suspect ← مراجعة صوت يدوية؛ ui_loss ← UI-01..06.
- `rita_turn_reviews` (RLS أدمن). الاحتفاظ: المراجعات 90 يوم، الأحداث التفصيلية 30 يوم.
- الكلفة: حد يومي (مثلاً 200 جلسة)، تخطي الجلسات الأقصر من 3 أدوار، حد شهري بلوحة OpenAI.
- المفتاح: `resolveRitaOpenAiKey()` (انظر القسم 1).

### المرحلة 5 — من التحليل للإصلاح
- تجميع أسبوعي حسب `categories + suspected_layer + build`؛ تكرار 3 مرات أو أكثر أو شدة 4 ← بطاقة في `rita_issues`.
- دورة الحالة: `new → triaged → reproduced → test_added → fix_in_pr → verified_staging → verified_prod`، أو `cannot_reproduce` وتبقى مفتوحة بأدلتها. تُغلق فقط إذا اختفت الفئة على `build` الجديد ونجح الاختبار.
- «ملف إصلاح جاهز لـClaude» لكل بطاقة: الأمثلة، دفاتر الأدوار، النسخة، الاختبار المقترح.
- صفحة `/admin/rita-quality`: أعلى 10 مشاكل مقارنة بالنسخة السابقة، المعدلات، p50/p95 لكل نسخة، فتح أي دور بأدلته. Design Brief قبل البناء.

### المرحلة 6 — إصلاحات السلوك بالبيانات
إصلاح واحد لكل PR بادئين بأعلى مشكلة بالأرقام؛ المرشّح الأول مهلة الجمل (G6 و`period`) بعد ما يثبتها الدفتر.

## 6. خطة الاختبارات (معرّفات من البحث)
TURN-01..06، INT-01..04، CTX-01..07، EDU-01..04، BUG-01، UI-01..06، EXP-01، OBS-01..04، SEC-01..06، PERF-01..03. إعادة الإنتاج بثلاث درجات: (1) إعادة تشغيل الأحداث بدون مزودين بساعة اختبار، (2) النص الصحيح مباشرة للنموذج، (3) صوت حقيقي عبر النظام الكامل. اختبارات المعرفة تحكم على المعنى واكتمال المهمة، مش التطابق الحرفي.

## 7. مؤجّل (وليش)
OpenTelemetry الكامل، الجداول الـ11، مهمة PDF خلفية بروابط موقعة، canary تدريجي، k6 — كبار على حجم المشروع الحالي؛ نرجع لها إذا صار في أشخاص غير صاحب المشروع يشوفوا بلاغات المستخدمين.

## 8. اللي على صاحب المشروع
- تطبيق الـmigrations بـLovable Cloud (المراحل 3 و4 و5)، وPublish ← Update بعد كل مرحلة فيها صفحة.
- التأكد من وجود مفتاح OpenAI في `/admin/ai-keys` (rita أو shared).
- قرار نص الموافقة والافتراضي للمتعلمين، والحد اليومي للكلفة، والموافقة على Design Brief للزر وصفحة الجودة.

## 9. الحالة
- [ ] المرحلة 0 — بانتظار مكالمة صاحب المشروع
- [x] المرحلة 1 — اندمجت (#70): دفتر الدور، `turn_ref`، `RITA_GIT_SHA`، المقاطعة الحقيقية، حدث `turn_ledger` بالصفحة
- [x] المرحلة 2 — اندمجت (#71): طابور محدود + دفعات + `metrics_dropped`، بدون migration
- [x] المرحلة 3 — اندمجت (#72): زر «في مشكلة بهذا الرد» + جدول `rita_issue_reports` (migration `20261024120000`) + زر «Repair file» لكل محادثة
- [x] المرحلة 4 — اندمجت (#73): محلل OpenAI لكل دور (بدون سقف تكلفة/توكنز بطلب صاحب المشروع)، مفتاح تشغيل/إيقاف واحد لكل المحادثات (`rita_review_settings`)، جدول `rita_turn_reviews`، cron كل 5 دقائق، التحليل داخل Repair file
- [~] المرحلة 4ب — فرع `claude/rita-review-compare`: مراجعة v2 — رد مرجعي بدون رؤية رد ريتا، فحص معلومات ولهجة، حكم بالترتيبين، تشخيص، تقييم عام للمحادثة، النتائج داخل Repair file (migration `20261024140000`)
- [x] المرحلة 5أ — اندمجت (#75): تجميع المشاكل في بطاقات (`rita_issues`)، صفحة `/admin/rita-quality` (صحة النسخ، Fix next، المعايير، 👍/👎)، ملف إصلاح لكل مشكلة، دمج، حالة محسوبة (watching/resolved/regressed). migration `20261024150000`
- [x] المرحلة 5ب — اندمجت (#76): اختبار الإعادة (`rita_replay.py` + نقطة Modal `replay_turns`، حكم جديد بالمراجع، تشغيل تلقائي بعد كل نشر للـworker، حالة «Test still fails»). migration `20261024160000`
- [~] المرحلة 5ج — فرع `claude/rita-golden`: فحص المحلل بـ16 حالة ذهبية (أغلاط معروفة وردود سليمة)، زر «Check the reviewer»، تشغيل تلقائي مرة لكل نسخة من معايير المحلل. migration `20261024170000`
- [ ] المرحلة 6
