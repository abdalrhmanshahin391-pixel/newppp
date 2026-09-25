# خطة: حفظ الكلمات تلقائيًا كفلاش كارد + تقليل سماع ريتا الخاطئ

## 1. لماذا لا تُحفظ الكلمات (سبب مؤكد من الكود)
- ريتا تحفظ الكلمة فقط إذا طابق سؤالك صيغًا محددة جدًا مثل "كيف أحكي / كيف أقول / ترجم". صيغ عامية شائعة لا تُلتقط، مثل: "كيف بحكي"، "كيف بقولوا"، "شو يعني … بالألماني"، "كيف اسمها بالإنجليزي"، "بالألماني شو…". فلا يبدأ استخراج الكلمات أصلًا.
- وحتى لو استُخرجت الكلمة، فهي تظهر فقط في قائمة الدرس ولا تُحفظ كفلاش كارد إلا إذا قلت صراحة "احفظها بالفلاش كارد".

**الحل (حسب اختيارك: الاثنين):**
- توسيع التعرف ليشمل العامية الأردنية/الخليجية والإنجليزية والألمانية، ويشمل أي رد تذكر فيه ريتا كلمة بلغة ثانية مع معناها.
- **حفظ تلقائي**: كل كلمة أو جملة تتعلمها تُحفظ فورًا كبطاقة في موضوع "كلمات ريتا" (أو مختبر الألماني للألمانية مع der/die/das والجمع)، بدون تكرار نفس الكلمة.
- تحت رد ريتا تظهر الكلمات المحفوظة كشرائح صغيرة مع زر "تراجع/حذف" بضغطة واحدة، وزر "حفظ" للكلمات التي لم تُحفظ.
- خيار في الإعدادات لإيقاف الحفظ التلقائي لمن لا يريده.

## 2. لماذا تسمعك ريتا غلط أحيانًا (بشرح بسيط)
Deepgram يُضبط على لغة واحدة (مثلًا العربية الأردنية). لما تحكي جملة فيها كلمة ألمانية أو إنجليزية، يحاول "يكتبها" كأنها عربية فيطلع كلام ثاني. النماذج الثانية التي فهمتك تسمع الجملة كاملة بعد انتهائها وتفهم خلط اللغات، لكنها أبطأ.

**الحل على ثلاث طبقات:**
1. **مجاني**: نعطي Deepgram قائمة "كلمات متوقعة" أذكى: كلمات درسك الحالي، آخر الكلمات التي تعلمتها، وأسماء اللغات. ونزيل كلمة "RitaJet" الثابتة التي قد تشوش العربي.
2. **مجاني**: ريتا نفسها تُبلَّغ أن النص قد يكون فيه خطأ سمعي، فإذا بدا غريبًا تفهم المقصود أو تسأل سؤالًا قصيرًا "قصدك …؟" بدل أن تجاوب على شيء ما قلته.
3. **رأي ثانٍ عند الشك فقط (موصى به)**: إذا كان Deepgram غير متأكد (ثقة منخفضة) أو الجملة فيها خلط لغات، نرسل نفس المقطع الصوتي لنموذج تفريغ ثانٍ أقوى ونأخذ النتيجة الأوضح.
   - الفائدة: يصلح معظم حالات "فهمها بشكل ثاني".
   - السلبية: تأخير حوالي نصف ثانية في هذه الجمل فقط، وتكلفة بسيطة جدًا (تقريبًا سنت واحد لكل 10 دقائق من الجمل المشكوك فيها). الجمل الواضحة لا تتأثر.
   - زر تشغيل/إيقاف في لوحة الإدارة، مع عداد لعدد المرات التي استُخدم فيها.

## التحقق
- اختبارات لصيغ عامية مختلفة لطلب الترجمة تؤدي إلى بطاقة محفوظة، وعدم تكرار الكلمة، وزر التراجع.
- اختبار جملة عربية فيها كلمة ألمانية تُفرَّغ بشكل صحيح بعد الرأي الثاني.
- فحص الكود والبناء، ثم تجربة على iPad. المعاينة فقط، بدون نشر إلا بإذنك.

## Technical details
- `src/lib/rita-learning-intent.ts`: broaden TRANSLATION/WORD_MEANING/LIST regexes (colloquial Levantine/Gulf, "بال(ألماني|انجليزي)", "in German", "auf Deutsch"); add reply-side check (reply contains Latin-script term + Arabic gloss, or vice versa).
- `src/routes/api/rita/extract.ts`: return items when either gate passes; persist server-side into `flash_cards` (default subject "Rita words", created if missing) or `german_word_entries` for `de`, deduped by normalized term per user; return saved ids.
- `src/routes/rita-live.tsx`: chips under reply with undo (delete by id) and manual save; setting `autoSaveWords` stored in `rita_user_preferences` (check columns; migration if needed).
- `src/lib/rita-economic.client.ts`: drop constant "RitaJet" keyterm for Arabic, dynamic keyterms (lesson terms, recent learned items, language names); expose Deepgram confidence and keep turn audio for second pass.
- New `/api/rita/retranscribe`: when confidence < 0.7 or mixed-script detected, send the turn WAV to Lovable AI Gateway `/v1/audio/transcriptions` with `google/gemini-3.5-transcribe` (language hint + keyterms prompt); 1.5s timeout, fall back to Deepgram text on failure/timeout. Admin toggle `second_pass_stt` in `rita_voice_settings` + counter in `rita_turn_metrics`.
- `respond.ts`: prompt line about possible ASR errors, ask "قصدك …؟" when implausible.
- Tests in `tests/rita-voice.test.mjs`.

do u want to apply it like lovable
