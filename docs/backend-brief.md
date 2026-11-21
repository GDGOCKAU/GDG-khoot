أنت مهندس Backend وFull-stack مسؤول عن إكمال مشروع GDG Kahoot الداخلي المسمى KAUHOOT لنادي GDGoC KAU في جامعة الملك عبدالعزيز.

المشروع موجود في GitHub:

https://github.com/GDGOCKAU/GDG-khoot

هو ريبو خاص تابع لمنظمة GDGOCKAU. آخر فرع عمل مخصص للباك اند والربط هو:

work/backend-mvp

لا تعمل على main مباشرة ولا تدمج work/backend-mvp في main قبل موافقة المستخدم. استخدم merge طبيعي لتحديث Frontend من main، ولا تستخدم rebase أو reset أو force-push. احفظ commit واضح بعد كل مرحلة ومرّر الفرع إلى GitHub بعد اكتمال checkpoint.

أول شيء نفذه:

1. نفذ git fetch origin --prune.
2. افحص branch وstatus والتاريخ.
3. أنشئ أو انتقل إلى work/backend-mvp:
   git switch work/backend-mvp
   git pull --ff-only origin work/backend-mvp
4. دمج تحديثات origin/main فقط إذا ظهر عليها commits جديدة:
   git merge origin/main
5. حل تعارضات الواجهة مع الحفاظ على Backend والتصميم المعتمد لجود.
6. افحص المشروع وبناءه قبل أي تعديل.
7. اعمل commit وpush بعد كل checkpoint منطقي.

فهم متطلبات المشروع:

- المشروع هو لعبة تفاعلية شبيهة بـKahoot بالهوية البصرية لنادي GDG، وليس نسخة بصرية حرفية من Kahoot.
- الواجهة المعتمدة موجودة في React + Vite وتم بناؤها من قبل جود.
- الهوية والألوان والشاشات والمascots الحالية إلزامية ولا تغيرها إلا لعلاج bug وظيفي أو عند موافقة المستخدم.
- يلزم تطوير واجهة مضيف وواجهة متسابق وواجهة أدمن.
- المتسابق يدخل بدون حساب.
- الدخول يمر عبر PIN من شاشة المضيف أو QR.
- اللاعب يختار nickname وmascot ومن فريق بحسب لون الماسكوت.
- كل اللاعبين يشاهدون السؤال نفسه في الوقت نفسه.
- المضيف يتحكم في: Start، بداية السؤال، Reveal، Next، Final، Cancel.
- لا تظهر الإجابة الصحيحة للاعب قبل Reveal.
- المضيف هو الشاشة الوحيدة التي تظهر الإجابة الصحيحة وأعداد الاختيارات والترتيب.
- النظام يدعم حاليًا الاختيار من متعدد وTrue/False وCode وPicture.
- اللاعبين الذين ينضمون في Lobby يظهرون للمضيف ويتجنبون الأسماء المكررة بحسب الجلسة.
- المنصة تستهدف حوالي 50 إلى 150 لاعبًا في الجلسة الواحدة.
- الفعالية الفعلية يفضل أن يكون النظام جاهزًا ومختبرًا قبل 21 نوفمبر 2026.
- الاستدامة المطلوبة تفوق نشاطًا واحدًا؛ الكويزات والجلسات يجب حفظها لإعادة الاستخدام.

Stack المستخدم حاليًا:

Frontend:

- React
- Vite
- React Router
- Socket.IO Client
- البيانات المؤقتة كانت في localStorage ويجب استبدالها تدريجيًا بالـBackend

Backend:

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- Socket.IO
- Zod
- JWT
- bcrypt/bcryptjs
- Vitest

البرمجان يشغلان حاليًا في نسخة المعاينة على:

- Frontend: http://192.168.100.120:5173/
- Backend: http://192.168.100.120:3000/

لا تعتمد على عنوان IP ثابت في الكود، استخدم متغيرات البيئة القابلة للتغيير.

هيكلة المشروع المتوقعة:

frontend/
backend/
docs/

حاليًا الواجهة موجودة في جذر الريبو، والـBackend في فولدر backend/. لا تنقل frontend إلى فولدر منفصل الآن بدون موافقة؛ لأن ذلك قد يخرب عمل جود ويلزم تعديل المسارات.

محتويات الـBackend الحالية:

- Node.js + TypeScript service
- Fastify routes
- Prisma schema/migration/seed
- Admin login
- JWT authentication
- Quiz/Question CRUD
- حفظ الدRAFT والنشر atomically
- GameSession وParticipant وAnswer
- PIN generation
- Socket.IO rooms
- Lookup by PIN
- Join participant
- Start question
- Reveal
- Next
- Leaderboard
- Final ranking
- duplicate participant rejection
- answer duplicate rejection
- server close timing
- basic server scoring
- اختبارات Vitest

حالة الداتابيس الحالية:

Database models الأساسية:

- Admin
- Quiz
- Question
- Option
- GameSession
- Participant
- Answer
- حالة الجلسة: LOBBY, ACTIVE, REVEAL, FINISHED, CANCELLED

حقول Question المطلوبة:

- id
- quizId
- text
- type
- order
- timeLimitSecs
- points
- img/imageUrl
- code
- language
- pictureUrls
- word
- options

تأكد أن الأنواع الأربعة محفوظة فعليًا في Prisma والـsave API والـby-pin payload.

لا ترسل to the player:

- correct
- isCorrect
- word الإجابة السرية
- points المحسوبة مسبقًا
- ترتيب حسّاس لإعلان النهاية قبل المرحلة المناسبة

حالة التنفيذ المرسومة سابقًا:

تم إنجاز:

- مشروع React/Vite وواجهات المضيف والمتسابق والأدمن متوفرة.
- Mascots والصور والشعار والهوية البصرية موجودة.
- Admin login مربوط بالـBackend.
- Dashboard يقرأ الكويزات من الـBackend.
- Draft يمكن حفظه وتعديله ونشره.
- كويز يمكن نشره وإنشاء جلسة منه.
- جلسة تحصل على PIN وQR.
- Join lookup يعمل من السيرفر.
- اللاعب ينضم عبر الاسم والمascot والفريق.
- الجلسة تمنع الأسماء المكررة case-insensitively.
- Socket.IO يوجد على غرفة game:<sessionId>.
- server authority موجود للوقت والإجابة والنقاط.
- منع الإجابة مرتين.
- منع الإجابة بعد الإغلاق.
- وجود MC/TF/Code/Picture fields في الـBackend بعد آخر تشيكات.
- إصلاح صفحة Join وLive route.
- إصلاح تصحيح live quiz بحيث لا يفرضها كـMC ويرفضها بسبب correct=-1.
- الإصلاح نجح بأن المتسابق انتقل فعليًا إلى /play.

لكن لم يكتمل التحقق النهائي من:

- اثنان أو أكثر من المتصفحات أثناء الجولة الكاملة.
- المضيف يضغط Start ثم يصل السؤال للاعبين فعليًا.
- اللاعب يجاوب، والمتصفح يتحول إلى reveal.
- العدّاد يستخدم server closesAt.
- أزرار المضيف: Reveal، Next، Final تعمل مع اتصال Socket.
- Code question يرسل code/language فقط ويعتمد الإجابة المحفوظة من السيرفر.
- Picture question يرسل الصور ويعتمد word من السيرفر.
- ترتيب وتحديث النقاط لحظة Reveal.
- فريق أزرق/أحمر/أصفر/أخضر وحساب متوسط الفريق.
- streak bonus حسب المعادلة المعتمدة.
- reconnect اللاعب وإصلاح duplicate socket join.
- Late participant بعد start.
- exit/cancel/lock behavior.
- رفع الصور فعليًا وليس Data URL في localStorage.

نظام النقاط المعتمد:

- إجابة صحيحة: ما بين 500 و1000 حسب السرعة.
- إجابة خاطئة أو بلا إجابة: صفر.
- streak:
  الإجابة الصحيحة الثانية المتتالية تبدأ streak bonus حتى 500 كحد أقصى.
- الوقت يوزن على السيرفر:
  elapsedMillis من question opening إلى answer arrival.
- لا تقبل timestamps أو نقاط من المتصفح.
- فريق اللاعب يختار حسب mascot/team.
- الفريق يحصل متوسط نقاط أعضائه ولا يكافأ بحجم الفريق.

الزمن والحالة:

المطلوب state machine:

LOBBY
-> GET_READY
-> ACTIVE
-> REVEAL
-> LEADERBOARD
-> ACTIVE للسؤال التالي
-> FINISHED

لو المضيف skipped أو انتهى السؤال مبكرًا فالأفضل إنه ينتقل إلى Reveal ويختم السؤال.
لا يسمح بإعادة فتح سؤال بعد إغلاقه.

API الحالية المتوقعة:

POST /api/v1/auth/login
GET /api/v1/quizzes
POST /api/v1/quizzes/save
GET /api/v1/quizzes/:id
PATCH /api/v1/quizzes/:id
DELETE /api/v1/quizzes/:id
POST /api/v1/quizzes/:id/questions
POST /api/v1/sessions
GET /api/v1/sessions/by-pin/:pin
POST /api/v1/sessions/join
POST /api/v1/sessions/:id/start
POST /api/v1/sessions/:id/reveal
POST /api/v1/sessions/:id/next
POST /api/v1/sessions/:id/final
GET /api/v1/sessions/:id/leaderboard
POST /api/v1/sessions/:id/answers
POST /api/v1/sessions/:id/leave
POST /api/v1/sessions/:id/cancel

أولًا تأكد أن endpoints الفعلية مطابقة للكود وليست مجرد توقعات، وثبت API contract قبل تعديل Frontend.

Socket events المتوقعة:

- player_joined
- session_created
- phase
- question
- answer_count
- answer result
- reveal
- leaderboard
- final
- closed
- game_started
- game_closed

اعتمد أسماء events الموجودة فعلًا في الكود قبل إضافة أسماء جديدة. لا تثبت أسماء فقط من هذه القائمة.

أخطر Bugs المعروفة سابقًا:

1. قيمة isPublished في Frontend كانت تضل Draft بسبب payload inconsistent. افحص Save endpoint transaction وعدم الاعتماد على حالة local only.
2. by-pin كان يرمي 409 أو 410 بعد start. هذا صحيح: لا يدخل متسابق جديد بعد start.
3. كان QR يحتوي localhost، تم إصلاحه ليستخدم window.location.hostname.
4. كان clean browser يرفض join لأنه يتوقع الكويز في localStorage المضيف.
تم إصلاحه جزئيًا بنقل live quiz payload عبر السيرفر.
5. liveQuiz.js كان يحول جميع أنواع السؤال إلى MC ويضع correct=-1.
تم إصلاحه جزئيًا بحفظ النوع والحقول.
6. engine.joinGame/newGame كان يطبق qProblem ويتطلب الإجابة الصحيحة محليًا.
تم إصلاحه ليشاهد live session من السيرفر دون qProblem.
لا تفترض أن الإصلاح الكامل انتهى؛ اختبره فعليًا.

قاعدة العمل:

- لا تعدل UI/layout إلا إذا كان ثغرة وظيفية أو مطلوب الربط.
- لا تغيّر Mascots أو الألوان أو الهوية المعتمدة إلا عند طلب واضح.
- لا تضف features خارج MVP: Dark mode إضافي، Automations، هاشتاق، حسابات دائم للاعبين، Social login.
- لا تصدّر الإجابة الصحيحة للاعبين.
- لا تستخدم timestamps من المتصفح لحساب النقاط.
- لا تحفظ صور جديدة بـbase64 في PostgreSQL.
- لا تشغل npm audit fix --force قبل مراجعة Prisma major separately.
- لا تحط secrets في Git.
- يجب أن يكون في commit واضح عند كل checkpoint.
- بعد كل مرحلة افحص git diff وgit status.
- Push إلى work/backend-mvp فقط حتى موافقة دمج main.

قاعدة الاختبار:

الاختبار الأساسي لازم يكون دورين فعليين:

1. Admin/Host:
- login
- create/draft/edit/publish
- host
- PIN/QR
- lobby
- start
- reveal
- next
- final
- cancellation

2. Participant:
- clean browser or another device
- enter PIN or QR
- nickname
- mascot/team
- lobby
- answer
- waiting
- reveal
- leaderboard
- final

اختبر مسارًا واحدًا كاملًا قبل التسليم.

لا تقبل تكملة عمل إذا لم ينجح:

- Frontend build
- Backend build
- 11+ Backend tests
- admin login
- quiz save/publish
- one complete live session
- join from clean browser
- start question
- answer
- reveal
- next
- final

خطواتك من الآن:

1. افحص branch وgit changes أولًا.
2. نفذ merge origin/main إذا كان هناك تحديثات جود بعد آخر checkpoint.
3. افحص وكرر الاختبار الحقيقي للاعب والمضيف.
4. أصلح دوريًا فقط أخطاء دورة اللعبة والربط.
5. أضف فقط حقول الصور/Code/Picture التي ما زالت ناقصة عند الحاجة.
6. نفذ stress test بـ50 و150 Socket.IO clients.
7. نفذ npm audit review في فرع منفصل وخطة Prisma 7 migration.
8. جهز docker-compose/env examples وREADME تشغيل.
9. جهز خطة Render/PostgreSQL deployment.
10. لا تنشئ Pull Request إلى main ولا تنشر production إلا بموافقة المستخدم.

ابدأ بتقرير قصير يوضح:

- الفرع والcommit الحالي
- حالة git
- ماذا اكتمل فعليًا
- ماذا فشل فعليًا
- الملفات التي ستعدلها
- ثم نفذ الإصلاحات الدورية على خريطة الأكشن هذه

لا تفترض أن التقرير يعني الجاهزية. الجاهزية تتحقق فقط بجولة حية بين مضيف ومتصابقين.

مراحل commit المقترحة:

- fix: live game routing and join
- feat: complete host/player game phase
- fix: question type and answer secrecy
- test: two-role browser smoke
- test: live socket load
- chore: deployment environment

التزم بالدقة ولا توقف في نص واحد من الواجهة إذا كان الكود الخلفي والجلسة يحتاجان إصلاحًا. أبلغني عندما يكون المشروع جاهزًا للدمج في main أو عندما يظهر قرار يتطلب موافقة المستخدم.