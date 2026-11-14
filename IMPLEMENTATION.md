Smart Spend Implementation Record
1. Project overview

SmartSpend is a full-stack personal-finance tracker with a React/Vite web frontend and an Express/MongoDB API. It supports INR transactions, wallets, a dashboard, transaction management and backend services for budgets, goals, recurring transactions, imports, and financial insights. Receipt/UPI scans and statement imports create reviewable drafts; they do not automatically modify a user's ledger. The browser can queue transaction changes while offline and cache the static app shell, but this is not a full offline PWA: other pages still require connectivity, and only queued transaction details plus limited user-scoped wallet/category references are stored locally.

This document is the current implementation record, architecture reference, and roadmap. The current-status sections take precedence over dated audit snapshots and historical test totals later in the document.

Status as of 2026-11-13: the supported backend modules have corresponding protected frontend routes, including budgets, goals, recurring transactions, analytics, imports/scans and financial intelligence. Step 22's integrated audit used isolated local test accounts and an in-memory replica-set database; it found no basis to claim every workflow or production integration is verified. Production deployment remains pending, and the staged backend archive is a release blocker because it contains an embedded `.env` file.

2. Technology stack

| Layer | Current implementation |
|---|---|
| Frontend | React 19, Vite, React Router, Axios, TanStack Query, React Hook Form, Zod, Tailwind CSS, Lucide React, Motion, and shared Radix/shadcn-style UI primitives |
| Frontend tests | Vitest, jsdom and React Testing Library |
| Backend | Node.js ES modules, Express 5, Mongoose/MongoDB, JWT access/refresh tokens, bcryptjs, Zod, Helmet, CORS, express-rate-limit and Multer |
| Backend tests | Node test runner, Supertest and MongoDB Memory Server; replica-set tests for multi-document transactions |
| AI/OCR integrations | Optional Google Cloud Vision OCR, OpenAI-compatible categorization, and Gemini/OpenAI-compatible Ask Spart adapters; credentials/configuration remain server-side |
| Deployment preparation | Render backend and Vercel frontend configuration; MongoDB Atlas is the intended production database |

Recharts, `vite-plugin-pwa`, Web Speech voice capture and Swagger UI are not present. Transaction queueing uses IndexedDB and a small static-only service worker without a PWA plugin; an installable manifest and broad offline data access remain future work.

3. Core design decisions
Decision	Reason
Money stored as integer paise (₹120.50 = 12050)	Avoids floating point errors in totals and budgets
Two timestamps per transaction: txnDate (when the purchase happened) and capturedAt (when it was recorded)	A receipt scanned today may be from yesterday
Transfers are a separate type and are excluded from income and expense totals	Prevents double counting between a user's own wallets
Soft delete (deletedAt)	Powers trash and undo
Optional clientId on transactions (UUID made on the device) with a unique index per user	Supports duplicate-safe transaction creation and offline sync retries
Scans create editable drafts; a transaction is created only after explicit user confirmation	Wrong OCR output never silently changes balances
Every user query is filtered by userId on the server	Data privacy cannot depend on the frontend
AI never invents numbers: Ask Spart calls query functions and only explains their results	No fake financial claims
All dates stored in UTC, displayed in the user's timezone (default Asia/Kolkata)	A transaction always lands on the correct day

4. Current implementation status

| Area | Current status |
|---|---|
| Backend project, configuration and environment validation | Implemented |
| Authentication | Register, login, refresh, logout, session restore and profile read/update are implemented. `/api/auth/me` exposes the current profile and accepts updates to name, phone, user type, timezone, language and four stored settings fields. Refresh/session restoration preserve tokens on transient failures; logout clears local state even if the server call fails. Password changes, email changes/verification, account deletion, session lists and login history are not implemented. |
| Profile, settings and security | Protected `/settings` centre edits supported name/phone/user type/timezone fields, retains read-only email, exposes account creation date, and reuses local theme/effects preferences. Unsupported API capabilities are explained instead of presented as working controls. |
| Wallets and transactions | Wallet CRUD/archive, derived balances, transfers, transaction CRUD, filters, soft delete/trash/restore and quick-add are implemented. The Wallets screen shows active wallet balances/count, add/edit/archive actions, and links each wallet to the existing wallet-filtered transaction list. Transfers are excluded from income/expense totals. |
| Categories | List/create/delete implemented; category editing is not implemented. Users can create owner-scoped categories from Quick Add and the standard transaction form, choose an icon, and immediately select the returned category ID. Creation rejects case-insensitive duplicates of the same user's and shared default categories. |
| Dashboard backend and frontend | Implemented. Dashboard uses the real dashboard API for balance, income/expenses, wallets, all monthly expense categories, individual expense descriptions and recent activity. A timezone-aware date control supports date selection and month/year navigation; selected-day spend and selected-month totals, category breakdowns and expense rows are loaded from the API. Wallet balances and all-time recent activity remain unchanged by the selected date. Expense totals, category totals and the five most recent monthly expense rows share the same timezone-correct, confirmed, non-deleted expense filter; income and transfers are excluded. Activity titles prefer merchant, then note, then category, with a type fallback. |
| Budgets, savings goals, recurring transactions | Backend APIs/services, database-backed tests and protected frontend pages are implemented. |
| Analytics and exports | Backend analytics and CSV/PDF exports plus protected analytics frontend page are implemented. |
| Receipt/UPI scan and statement import | Backend supports private uploads, editable drafts, duplicate review and explicit confirmation; protected scan/import frontend pages are implemented. Statement uploads preserve the 10 MB limit and CSV/XLSX/selectable-text PDF handling; the upload request uses a longer request-specific timeout so server parsing is not cut off by Axios's general 10-second default. Upload still creates review drafts only; transactions require explicit confirmation. |
| Smart categorization | Backend suggestions, owner-specific merchant rules and optional validated AI provider plus protected frontend page are implemented. |
| Ask Spart, anomaly detection, expense prediction and subscriptions | Backend modules implemented with owner-scoped queries and tests; corresponding frontend pages are implemented and routed. |
| Financial health | On-demand, owner-scoped backend scoring and breakdown APIs implemented; protected `/financial-health` page displays only returned score, indicators, insights and financial figures. Score history is not persisted or fabricated. |
| Notifications | Owner-scoped in-app notification model, detection job and APIs implemented; protected `/notifications` centre lists, filters, paginates, reads and deletes notifications using those APIs. Step 18 is not fully complete: the page shows the current filtered total and unread count, but not a separate overall total/read-count overview. Preferences and real-time delivery are not supported by the backend. |
| Offline synchronization | Backend `/api/sync` push/pull/status APIs and a frontend user-scoped IndexedDB queue are implemented for transaction create/update/delete. Automatic/manual retry, conflict review, pending-create indicators and static-only app-shell caching are included. Offline reads, wallet/category edits and file synchronization are not supported. |
| Frontend routes | Public `/`, `/login`, `/register`; protected `/dashboard`, `/transactions`, `/categorization`, `/ask-spart`, `/anomalies`, `/scans`, `/imports`, `/wallets`, `/budgets`, `/goals`, `/recurring`, `/analytics`, `/predictions`, `/subscriptions`, `/financial-health`, `/notifications`, and `/settings`. |
| Landing, design system, navigation and authentication UI | Landing page redesign, global semantic theme tokens, shared UI primitives, desktop sidebar, mobile bottom navigation, theme/effects settings, and responsive Login/Register pages are implemented. Authentication pages retain the existing API, validation, token and route-protection flows. Registration's Continue action uses the filled auth-button styling and an accessible next-step icon. |
| Installable PWA, offline read cache, i18n, PIN lock, account deletion and password reset | Not implemented. The service worker only caches static assets/app shell; transaction operations use IndexedDB. |
| Deployment preparation | Render/Vercel configuration, production environment checks, fail-fast frontend API URL validation, and proxy-aware backend rate limiting are implemented; deployment itself has not been performed. |

The backend test suite uses Node's test runner, Supertest and MongoDB Memory Server, including replica-set integration coverage for transactional modules. The frontend uses Vitest and React Testing Library. Test totals are run-specific; see Section 13 for the latest recorded frontend result and warnings.

5. Database design (MongoDB)

All collections include createdAt and updatedAt. All user-owned collections include userId (indexed).

Implemented models are User, Wallet, Transaction, Category, Budget, Goal, GoalContribution, RecurringTransaction, Subscription, Notification, SyncOperation, Scan, BankStatementImport, StatementTransactionDraft, CategorySuggestion, MerchantCategoryRule, ChatConversation, ChatMessage and TransactionAnomaly. Expense predictions and financial-health scores are calculated on demand and are not persisted.

Users
Field	Notes
name, email (unique, lowercase), phone	email unique index
passwordHash	bcrypt, never returned in responses
userType	student, professional, homemaker, family, business, other
currency	default INR
language	en, hi, kn
timezone	default Asia/Kolkata
settings	autoSaveHighConfidence (bool), confidenceThreshold (default 0.85), reminderTime, pinHash, simpleMode
refreshTokenHash	for refresh rotation
Wallets

userId, name, type (cash | bank | upi | card), openingBalance, isDefault, archived Balance is computed from transactions (see Section 7), with an optional cached currentBalance that is recomputed after each write.

Transactions
Field	Notes
userId, walletId	required
type	income, expense, transfer
amount	integer paise, always positive
categoryId	null for transfers
merchant, note, tags[]	merchant normalized into merchantKey for rules
paymentMethod	cash, upi, debit_card, credit_card, net_banking
txnDate	purchase date and time
capturedAt	when it was recorded
source	manual, quickadd, voice, receipt, screenshot, statement, sms, recurring, reconciliation
status	confirmed, pending_review
receiptId	link to Receipts
items[]	{name, qty, price, categoryId} for item-level tracking
upiRef	UPI reference number, when known
transferPairId	links the two sides of a transfer
linkedTransactionIds[]	records merged from different sources
isUnlogged	true for reconciliation entries
dedupeHash	hash of merchant + amount + date for fast lookup
clientId	UUID from the device, unique per user
recurringScheduleId	links a generated transaction to its recurring schedule
deletedAt	soft delete

Indexes: {userId, txnDate:-1}, {userId, categoryId, txnDate}, {userId, walletId}, {userId, clientId} (unique), {userId, dedupeHash}, {userId, upiRef} (sparse), {userId, deletedAt}.

Other implemented collections
Collection	Key fields
Categories	userId (null = shared default), name, icon, color, type (expense/income)
Budgets	userId, name, categoryId (null = overall), period (weekly/monthly/yearly/custom), integer-paise amount, startDate, endDate, status (active/archived)
Goals	userId, name, description, integer-paise targetAmount and savedAmount, targetDate, optional walletId, status (active/completed/paused/archived)
GoalContributions	userId, goalId, type (contribution/withdrawal), positive integer-paise amount, contributionDate, note
RecurringTransaction	userId, name, income/expense type, integer-paise amount, walletId, optional categoryId, description, frequency, startDate, nextDueDate, optional endDate, lastGeneratedDate, status (active/paused/completed/cancelled)
Subscription	userId, normalized merchant and category, estimated amount/frequency, observed evidence, confidence and review status
MerchantCategoryRule	userId, normalized merchantKey, transactionType, categoryId; unique per user, merchant and type
CategorySuggestion	userId, transactionId, suggested/reviewed category, confidence, source, alternatives and review status; unique per user and transaction
ChatConversation	userId, title and active/archived status
ChatMessage	userId, conversationId, role, content and bounded financial-query metadata
TransactionAnomaly	userId, transactionId, type, score/severity, explanation, evidence, status and timestamps; unique detection-event key prevents duplicate records
Scan	userId, type (receipt/upi), private image key/type/size, extraction status, extracted and editable draft fields, confidence, warnings, possible duplicates, processing error, linked transaction and confirmation client ID
BankStatementImport / StatementTransactionDraft	Owner-scoped import metadata and editable statement rows; transactions are created only after confirmation
SyncOperation	userId, clientOperationId, operation/entity types, payload/result, status, conflict details and processing time
Notification	userId, type/severity, presentation text, related entity, read state, deduplication key and expiry
Receipts and ReviewQueue	Not separate models; Scan and StatementTransactionDraft implement their explicit draft/review workflows.

CashCheckins, Favorites and SharedGroups are not implemented models.

6. Backend structure
backend/
├─ config/         db.js, env.js
├─ models/         User, Wallet, Transaction, Category, Budget, Goal, Subscription, Notification, SyncOperation, Scan and supporting models
├─ controllers/    auth, wallet, transaction, category, dashboard, budget, goal, recurring, analytics/export, scan/import, categorization, assistant and intelligence modules
├─ services/       balance, budget, goal, recurring, analytics, scan/import, categorization, assistant and financial-intelligence services
├─ jobs/           recurring transaction, scan/import cleanup and notification detection jobs
├─ middleware/     auth, validate, rate limits, error handling and bounded file uploads
├─ routes/         auth, wallets, transactions, categories, dashboard, budgets, goals, recurring, analytics, exports, scans, imports, categorization, Ask Spart, anomalies, predictions, subscriptions, financial health, notifications and sync
├─ validators/     schemas.js
├─ utils/          tokens, dates, merchant, apiError, asyncHandler, seedCategories
├─ tests/          api.test.js, validators.test.js, categories.test.js, dashboard.test.js, budgets.test.js, goals.test.js, analytics.test.js, scans.test.js, statementImports.test.js, categorization.test.js, askSpart.test.js, anomalyDetection.test.js, expensePrediction.test.js, subscriptionDetection.test.js
├─ app.js
└─ server.js

Rules:

Controllers stay thin. Logic lives in services/ so it can be unit tested.
All input passes through a Zod schema before reaching a controller.
All errors flow through one error middleware and return the same JSON shape.

Upload validation and private local storage adapters are implemented for scans and statement imports. Recurring generation and notification detection use in-process scheduled jobs. No API documentation UI is currently mounted.

Response format

json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }

Error codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, DUPLICATE_SUSPECTED, INSUFFICIENT_DATA, FILE_INVALID, FILE_TOO_LARGE, PAYLOAD_TOO_LARGE, RATE_LIMITED, CONFLICT.

7. Core business logic
7.1 Wallet balance
balance = openingBalance
        + sum(income into wallet)
        − sum(expense from wallet)
        + sum(transfers in)
        − sum(transfers out)

Only confirmed, non-deleted transactions count.

7.2 Transfers

A transfer creates two linked records (out of wallet A, into wallet B) in one MongoDB transaction, sharing a transferPairId. Transfers never appear in spending totals, category charts or budgets.

7.3 ATM withdrawal

There is no ATM-specific workflow. If a cash withdrawal is entered as a transfer from a bank wallet to a cash wallet, it is excluded from expense totals and the cash is counted when later spent.

7.4 Budget checks and notifications

Budget progress is calculated by the budget services. The in-app notification job periodically checks budget thresholds and deduplicates notifications; it is not a synchronous per-transaction alert hook. See Section 27 for the actual polling interval, event keys and supported alert types.
7.5 Receipt and UPI scan pipeline

The implemented scan flow accepts JPEG, PNG and WebP files (up to 5 MB), verifies file signatures/structure, stores images using a private local storage adapter, and extracts text using the configured Google Cloud Vision provider. Conservative extraction produces editable drafts; missing values remain null. Candidate duplicates are identified using the owner's transactions. No scan is auto-saved as a financial transaction: the user edits/reviews and explicitly confirms. Confirmation validates the wallet/category and uses MongoDB transaction/idempotency safeguards. PDF scan ingestion, automatic save, merge and general transaction duplicate resolution are not implemented. See the Step 6 details below for endpoint and storage configuration.

7.6 Duplicate detection

There is no general transaction duplicate-scoring or merge workflow. Scan and statement-import flows perform their own owner-scoped candidate checks and require explicit user review; import/scan confirmation supports explicit override of a possible duplicate. Do not treat the broader score-and-merge design below as implemented.

#### Step 6 scanner API and operations

| Method | Route | Behavior |
|---|---|---|
| POST | `/api/scans/receipt` | Authenticated multipart receipt upload |
| POST | `/api/scans/upi` | Authenticated multipart UPI screenshot upload |
| GET | `/api/scans` and `/api/scans/:id` | List/read scans owned by the signed-in user |
| PATCH | `/api/scans/:id` | Edit extracted draft fields only |
| POST | `/api/scans/:id/confirm` | Validate wallet/category and explicitly create/link one transaction |
| DELETE | `/api/scans/:id` | Remove the scan and private image |

Uploads accept only JPEG, PNG and WebP, with a 5 MB cap and signature/structure checks. Multer uses bounded in-memory upload storage; saved files use generated identifiers and a private local storage adapter. `SCAN_STORAGE_DIR`, `SCAN_RETENTION_DAYS`, `OCR_PROVIDER`, `OCR_API_KEY`, and `OCR_TIMEOUT_MS` are validated environment values. `OCR_API_KEY` must remain server-side. Local development uses `private/scans`; production must provide a persistent private volume or replace the adapter with shared private object storage. A bounded cleanup process runs at startup and once per day; it deletes expired image objects before their scan records. MongoDB confirmation uses transactions, so use Atlas or a replica set. For multiple API instances, storage deletion must be idempotent.

Example explicit confirmation request:

```json
{
  "type": "expense",
  "walletId": "64f000000000000000000001",
  "categoryId": "64f000000000000000000002",
  "paymentMethod": "upi"
}
```

Confirmation returns the linked transaction; a retry returns it with `duplicate: true`. Potential duplicates block confirmation unless the user explicitly sets `allowPossibleDuplicate: true`. UPI confirmation requires payment status `success` and respects detected direction. OCR errors return safe messages and preserve a failed scan for review; no scan path creates a transaction automatically.

7.7 Statement import

CSV, XLSX and text-based PDF imports create editable owner-scoped drafts. The user maps/reviews rows, resolves or overrides duplicate candidates, and explicitly confirms selected rows before transactions are created. Scanned/image-only and encrypted PDFs are not supported. See Section 20 for limits, exact routes, storage and known parser limitations.
7.8 Cash reconciliation

Cash reconciliation and a nightly cash check-in are roadmap items; no reconciliation API or user-facing flow is implemented.

7.9 Merchant categorization preferences

Owner-specific merchant-to-category preferences are implemented through the categorization rules API. Corrections can inform later suggestions for the same owner. This is separate from the broader unimplemented cash reconciliation/favorites features; see Section 21.

7.10 Explainable financial intelligence

Anomaly detection, expense predictions, subscription detection, financial-health scoring and Ask Spart are implemented in backend services/APIs. They use owner-scoped recorded data; predictions, anomaly scores and health scores are estimates/heuristics, not guarantees. Their actual thresholds, evidence, endpoints and limitations are documented in Sections 22–27; the simplified target formulas sometimes used in early planning are not specifications for the current implementation.

8. API surface

The API is mounted under `/api`. Routes are authenticated unless identified as health or authentication endpoints. Detailed contracts for specialized modules are described in Sections 18–29.

| Route base | Implemented capabilities |
|---|---|
| `/health`, `/health/db` | Application and database health |
| `/auth` | Register, login, refresh, logout, `GET /me`, and `PATCH /me` for supported profile fields and persisted settings |
| `/wallets` | Wallet list/create/update/archive and wallet transfers |
| `/categories` | List/create/delete; category PATCH/edit is not implemented |
| `/transactions` | Create/list/filter/read/update, trash, restore |
| `/dashboard` | Dashboard summary and recent transaction data |
| `/budgets`, `/goals`, `/recurring` | Budget, savings-goal and recurring-schedule APIs |
| `/analytics`, `/export` | Analytics reports and transaction CSV/PDF exports |
| `/scans`, `/imports` | Receipt/UPI scan drafts and bank-statement import/review |
| `/categorization` | Category suggestions, feedback and merchant rules |
| `/ask-spart` | Read-only financial assistant and conversation history |
| `/anomalies`, `/predictions`, `/subscriptions`, `/financial-health` | Financial intelligence APIs |
| `/notifications` | In-app notifications, unread counts, read/delete operations, filters and pagination |
| `/sync` | Offline-operation push, pull and status; this is not `/transactions/bulk` |

Not implemented API/product capabilities include password reset, a general duplicate merge API, favorites, voice parsing, cash reconciliation, category editing, and API documentation UI. Notification preferences and real-time push are unsupported. Unknown routes return a JSON 404.

9. Frontend implementation

The application is a React 19/Vite SPA with React Router, TanStack Query for server state, Axios for APIs, React Hook Form/Zod for forms, Tailwind CSS, Lucide icons, Motion and shared UI primitives.

| Route | Screen and access |
|---|---|
| `/` | Public landing page; signed-in users can continue to the dashboard |
| `/login`, `/register` | Public-only authentication routes |
| `/dashboard` | Protected dashboard backed by `/api/dashboard` |
| `/transactions` | Protected transaction list, filters, trash/restore and add/edit flows |
| `/wallets` | Protected wallets, balances, transfers and wallet management |
| `/financial-health` | Protected on-demand financial score, supported indicators and returned recommendations |
| `/notifications` | Protected notification centre with backend filters, pagination, read/unread, unread count and delete actions |
| `/settings` | Protected profile editing, local appearance preferences, account/security information and offline-safe logout |
| Other paths | Not found |

Auth bootstrap supports `loading`, `authenticated`, `unauthenticated`, and `unavailable`. Protected routes and public-only login/register redirects use the existing auth context. Theme selection supports light/dark/system. Effects support Auto/Full/Reduced, persist to `smart-spend-effects`, and respect OS reduced motion independently. Auto low-power detection checks save-data/2G, device memory <= 2 GB, and hardware concurrency <= 2.

Login and registration use the existing auth endpoints and validation rules. Login requires email and password; registration requires name, email and a password of 8–72 characters containing a letter and number, with optional phone and the supported user-type selection. Password visibility is toggled locally; no remember-me or forgot-password UI is shown because those flows are not supported. Registration's first-step Continue action uses the filled auth-button style and a next-step icon so its label remains legible against the dark auth background. The shared auth layout uses the dark fintech theme across screen sizes and respects reduced motion.

The desktop shell uses a sidebar; mobile uses a bottom nav and the existing Quick Add action. Navigation includes Financial Health and Notifications. Notifications consume the existing `/api/notifications` list, unread-count, mark-read/read-all, and delete-one/delete-all APIs; filters and pagination are passed through to the backend. The unread count refreshes periodically, not through push delivery. Preferences and real-time notification APIs are not available. The Financial Health page uses the existing `/api/financial-health/score` response; missing values and insufficient history are not replaced with invented data, and no score history is implied. The Wallets page uses backend-derived balances, displays active wallets only, and refreshes wallet, transaction and dashboard queries after successful mutations. Wallet activity uses the existing `/api/transactions?walletId=...` filter; there is no separate wallet-history endpoint. Quick Add has real transaction creation paths and is not a decorative landing-page control. Shared money/date helpers use paise and the user's timezone. Dashboard visual styles are locally scoped to preserve its design. The Landing page has its own responsive stylesheet and an illustrative, explicitly non-account-specific product preview; it does not display fabricated personal balances or transactions.

There is no installable frontend PWA manifest, voice entry, favorites, i18n, PIN lock, password change/reset, email change/verification, account deletion, or onboarding route. The service worker caches only the static shell/assets and never `/api/` responses. IndexedDB holds queued transaction details, limited owner-scoped wallet/category reference snapshots and sync metadata; it does not persist transaction history. Offline queueing is limited to transaction mutations; non-transaction pages and reference-data refresh still require connectivity.

10. Security implementation and remaining scope

Implemented controls include bcrypt password hashing; access and rotating refresh tokens; auth/rate limits; Helmet and configured CORS; Zod validation; owner-scoped database operations; generic production errors and structured safe logging; bounded uploads with signature validation; private local file storage; validated production environment settings; server-side optional AI credentials; and graceful shutdown. The production Express app trusts one Render proxy hop so IP-keyed rate limits use the client address rather than the shared proxy address. Logs omit request bodies, authorization headers, secrets, and raw production error messages. Refresh/session restoration preserve tokens on network, timeout, rate-limit and server failures. A refresh attempt ends the session only when the refresh token is missing or the refresh endpoint returns 400/401/403; bootstrap clears tokens only on 401/403. Logout clears local state even if the server call fails. Account management exposes only supported actions; the settings page explains that access JWTs are not individually revoked, and there is no remote-session or login-history API.

Production security hardening and deployment prerequisites are summarized in Section 29. Password change/reset, email change/verification, account deletion, PIN/app lock, explicit external-AI consent UI, signed cloud object storage, and a distributed scheduler are not implemented. Local private storage and in-process jobs need additional production planning before horizontal scaling.

11. Environment configuration

`backend/.env.example` is the authoritative list of backend configuration names and contains placeholders only. `backend/config/env.js` validates required secrets, URLs, optional provider configuration and production restrictions. `frontend/.env.example` documents the local API URL; `VITE_API_URL` is public build-time configuration, not a secret. Production frontend builds fail clearly unless it is an absolute HTTPS URL ending in `/api`, matching the Render backend. The Axios client trims trailing slashes to keep refresh and API paths consistent. Local Vite development can use the `/api` proxy or the example direct URL. Do not copy example placeholder values into production. Provider keys remain server-side; see `frontend/vercel.json` and Section 29 for deployment setup.

12. Build phases and acceptance status

| Phase | Scope | Status |
|---|---|---|
| Core application | Auth, wallets, transactions, dashboard | Backend and the Dashboard/Transactions/Wallets frontend routes implemented |
| Budgets, savings goals, recurring schedules | Backend services, APIs and tests plus protected frontend pages implemented |
| Analytics and exports | Backend APIs, CSV/PDF exports and protected frontend reports implemented |
| Scanning and statement imports | Backend explicit-review draft flows and protected scan/import pages implemented |
| Categorization and assistant | Backend suggestion/rules and read-only Ask Spart APIs plus protected frontend pages implemented |
| Financial intelligence | Anomalies, predictions, subscriptions, health score and in-app notification APIs plus protected frontend pages implemented |
| Frontend experience | Dashboard redesign, global design system/navigation and Landing redesign implemented; auth, transactions and wallets remain existing functional flows |
| Offline/PWA | Backend `/api/sync`, browser-side transaction queue, service worker, Sync Centre and conflict/attention UI implemented; offline read cache, file sync and installable PWA remain outstanding |
| Production readiness | Render/Vercel templates, environment validation and one-hop proxy rate-limit handling prepared; deployment and live infrastructure validation remain outstanding |
| Optional integrations | Android SMS, WhatsApp and Account Aggregator are not implemented; Account Aggregator requires regulatory onboarding |

13. Tests and validation

Backend tests use `node --test --test-concurrency=1` from `backend/`, with Supertest and MongoDB Memory Server. Coverage includes API validation/ownership, financial calculations, transactions/transfers, budgets/goals/recurring schedules, analytics, scans/imports, categorization, Ask Spart, anomalies, predictions, subscriptions, health scoring, notifications, sync and environment rules. Transaction-backed integration tests require an in-memory replica set or a replica-set-capable MongoDB.

Frontend tests use `npm test -- --run` from `frontend/` (Vitest + React Testing Library). The Step 22 full suite passed **317 tests across 86 files**. The full backend suite passed **167 tests**; focused transaction-search tests passed, and the focused offline-mutation tests passed **4/4**. Frontend lint passed with zero errors and warnings. The production build passed with `VITE_API_URL=https://api.example.invalid/api`; the existing main-chunk size advisory remains (524.89 kB). A production build without `VITE_API_URL` correctly fails fast. Notification UI tests cover supported API contracts, filters, pagination, read/delete actions, loading/empty/error/retry states, refresh and links. Backend tests cover notification ownership, read/delete, filters and pagination; the browser run checked the empty state, not interactive read/delete actions. Financial Health tests cover score rendering, dimensions, missing/insufficient data, returned insights, refresh and errors. Authentication tests cover valid and invalid login, API field and network errors, registration validation and duplicate-email handling, password visibility, navigation between auth routes, and success redirects. Dashboard regressions cover merchant/note/category title fallback, recent activity and expense row details, multiple categories, income exclusion, zero spend, matching totals/lists, and month-boundary filtering. Date-helper tests also cover Asia/Kolkata and a daylight-saving transition.

The Step 22 browser run used the real local Vite frontend and Express API backed by a dedicated in-memory MongoDB replica set; no production database or real user financial data was used. It verified registration/login, invalid login, auth persistence after refresh, protected-route behavior, logout, and account isolation. It also checked dashboard and transaction persistence; wallet create/edit/transfer; budget threshold and savings-goal contribution; recurring schedule create/pause/resume/cancel; analytics date filtering and CSV/PDF export responses; transaction edit/trash/restore and category search; and a CSV statement review, correction, selected-row import and explicit duplicate acknowledgement. Offline network emulation confirmed that an expense remained queued in IndexedDB and synchronized once connectivity returned, with one server transaction and an empty queue. Viewport checks at 390, 768 and 1440 CSS pixels found no horizontal overflow on the importer page; mobile bottom navigation was present. A lazy route not already loaded could not be opened while offline. Tablet/mobile visual and keyboard-accessibility reviews, real-device behavior, production deployment, and live OCR/AI provider calls remain unverified; see Section 32 for the feature-by-feature status.

The lint configuration exempts React Hook Form components from the React Compiler compatibility warning, and `useMediaQuery` uses `useSyncExternalStore` for media-query subscriptions. Browser offline testing used network emulation and does not establish real-device or prolonged-outage behavior.

Before release, resolve the staged-archive blocker, review dependency/security advisories, and verify deployment configuration and provider-backed features in a properly configured staging environment. Real-device camera, installable-PWA and network-transition checks remain pending.

14. Known limitations

- UPI/payment providers do not offer a public API integration here. The app records manually entered transactions and supports screenshot/statement ingestion; it does not read PhonePe/Google Pay history.
- Account Aggregator is not integrated. Production use would require applicable regulatory onboarding.
- Cash records require user entry; automated reconciliation is not implemented.
- Scanned receipts/UPI screenshots require supported image formats and OCR/provider configuration. OCR output is only a draft and must be reviewed.
- Statement PDF parsing is heuristic and supports text PDFs only; image-only/encrypted PDFs are rejected.
- Categorization and optional AI output are suggestions; they can be unavailable or incorrect.
- Predictions, anomaly classifications and financial-health scores are estimates based on data recorded in SmartSpend, not guarantees, calibrated fraud probabilities, or financial advice.
- Backend in-process recurring/notification jobs are not distributed. Private uploads use local storage and require a durable private volume or shared object-storage adapter for production.
- Offline mode queues only transaction create/update/delete operations. It does not provide offline transaction history or broad private API caching; limited owner-scoped wallet/category references are saved in IndexedDB for transaction entry. Queued creates are visibly pending and are excluded from confirmed balances/reports until accepted by the server. Wallet/category changes and uploads are not queued. The app shell's offline fallback depends on a previously cached static shell; offline navigation to a lazy route that has not yet loaded can fail. The queue-and-reconnect flow was checked in browser network emulation, but real-device and prolonged-outage behavior remains unverified.
- Profile API updates support name, phone, user type, timezone, language and persisted settings fields, but language and the nested settings fields are not consumed by current app behavior. Currency remains INR. Existing phone numbers cannot be cleared with the current validator.
- There is no password-change, email-change/verification, account-deletion, active-session listing, remote sign-out or login-history endpoint. The backend stores one hashed refresh token per user; logout revokes it only if the server is reached. Access JWTs are stateless and can remain valid until their configured expiry.
- Automated frontend coverage is narrower than backend API coverage, and the browser audit did not exercise every supported workflow end to end.
- Production deployment has not been performed.

15. Current next steps

The Landing page, global design system/navigation, Dashboard, feature pages, transaction-focused offline synchronization and supported profile/settings centre are implemented. Remaining roadmap items include full PWA/offline reads, password change/reset, email verification, account deletion, category editing, cash reconciliation, favorites/voice, broader profile/security capabilities, and deployment. The staged backend archive must not be shared or committed until its embedded environment file is safely handled; the audit left both archives unchanged.

16. Maintenance note

Update this document after each approved feature or infrastructure change. Keep the current status, implemented API surface, frontend routes, test results and limitations synchronized with code. Preserve historical audit snapshots as dated records and do not use their old estimates or findings as present-day status.

17. Archival backend audit baseline before Budget Management (2026-11-04)

The following is a historical snapshot, not current status. It predates the implemented backend modules documented in Sections 18–29 and must not be used as the current implementation checklist.

### A. Existing architecture

The backend is an ES-module Node.js/Express API using Mongoose and MongoDB. Zod schemas validate request bodies, query strings and path IDs; auth middleware verifies access JWTs and loads the user; controllers use user-scoped Mongoose filters; `balanceService.js` derives balances from confirmed, non-deleted transactions. Transfers are two transaction documents created in a MongoDB session. The app enables Helmet, a configured CORS origin, JSON body limits, and global/auth rate limits.

### B. Completely implemented

- Register, login, refresh-token rotation, logout, and authenticated profile read/update.
- Wallet creation/list/update/archive, derived balances, and paired transfers.
- Transaction create/read/list/update, pagination and filters, soft delete/trash/restore, and optional `clientId` idempotency.
- Default and user-owned category listing, custom category creation/deletion.
- Dashboard balance, today/month totals, top categories, and recent transactions.
- Shared validation, auth, error handling, environment checks and rate limiting.

### C. Partially implemented

- Categories cannot be edited.
- Profile settings only expose fields in the current update schema; currency, password reset and account deletion are absent.
- A transaction dedupe hash is stored, but there is no candidate scoring, duplicate review or merge endpoint.
- `pending_review` exists in the Transaction schema, but current transaction creation always confirms records and there is no review queue.
- Transfers are atomic on a replica set, but the backend has no explicit overdraft/sufficient-funds policy.
- The 14 passing tests are unit/HTTP validation-oriented; they do not validate database persistence, user-to-user isolation, balances or transfer atomicity.

### D. Missing

Budget/goal/recurring/analytics models and APIs; receipt and UPI screenshot scanning; bank statement upload/extraction; duplicate resolution and merge UI; favorites/repeat/voice; cash reconciliation; merchant rules; intelligence/Ask Spart; offline bulk sync; scheduled jobs; API docs; password reset and account deletion.

### E. Bugs, security issues and technical risks

- **Medium — logout does not revoke already-issued access JWTs.** Clearing the refresh-token hash does not invalidate access tokens, which remain accepted by `requireAuth` until expiry (default 15 minutes). A copied token can therefore access protected financial data after logout until it expires. See `backend/controllers/authController.js` and `backend/middleware/auth.js`.
- **Timezone boundary risk — dashboard day bounds assume every local day is exactly 24 hours.** In valid timezones with daylight-saving transitions, the fixed `dayStart + 24 hours` end can produce incorrect daily totals; the timezone helpers also calculate offsets at the input instant, which can differ from the offset at a target month boundary. See `backend/controllers/dashboardController.js` and `backend/utils/dates.js`.
- **Registration consistency risk —** user creation, default-wallet creation and token issuance are separate writes, so a later failure can leave a partially initialized account.
- **Transfer policy is unspecified —** transfers and expenses can result in negative balances. Decide whether this is permitted before adding a rejection rule.
- **Test confidence is limited —** current tests pass but do not cover MongoDB-backed business behavior or ownership isolation.
- No clearly unused backend runtime dependency was identified from the current source/manifests. No major duplicate implementation was found.

### F. Database models for future modules

Add MerchantRule, CashCheckin and Favorite models as those modules are implemented. A Scan model now stores private receipt/UPI uploads and review drafts; separate Receipt and ReviewQueue models are not currently needed for this workflow. SharedGroups is only needed if shared/family finances are in scope. Intelligence summaries can initially be derived from transactions rather than persisted as a separate model. The current User, Wallet, Transaction, Category, Budget, Goal, GoalContribution, RecurringTransaction and Scan models provide the implemented relationships.

### G. Recommended implementation order

1. Budgets and alerts, with period-boundary and persistence tests.
2. Savings Goals, with atomic contribution/withdrawal ledger tests.
3. Analytics and export.
4. Reconciliation, favorites, voice capture and merchant rules.
5. Explainable intelligence and Ask Spart, using server-side query tools.
6. Offline batch sync and deployment hardening.

### H. Exact files for the next development step

The Budgets, Savings Goals and Recurring Transactions modules are implemented. Subsequent modules should be scoped and approved separately.

18. Savings Goals implementation (2026-11-04)

The backend Savings Goals module is implemented under `/api/goals`. Goals store integer-paise targets and saved amounts, a target date, optional owner-validated wallet reference, and active/completed/paused/archived status. `GoalContribution` stores contribution and withdrawal history independently from wallet transactions. Amount changes update the goal and insert the corresponding ledger entry in one MongoDB transaction; contributions cannot exceed the remaining target, withdrawals cannot exceed saved funds, and a withdrawal from a completed goal reopens it when below target. Goal integration tests use an isolated in-memory replica set. The complete backend suite passes with 43 tests covering existing backend behavior, budgets, goal persistence, ownership, contribution concurrency, status transitions, date calculations and contribution history.

19. Recurring Transactions implementation

The recurring module is mounted at `/api/recurring`. `RecurringTransaction` stores owner, name, income/expense type, positive integer-paise amount, owner-validated wallet, optional type-compatible category, frequency, UTC-midnight calendar dates and active/paused/completed/cancelled status. `Transaction.recurringScheduleId` links generated ledger entries back to their schedule. Authenticated APIs create, list, read, update, pause, resume, cancel, delete-as-cancel, show upcoming schedules, and return generated transaction history.

The server runs an immediate pass after connecting to MongoDB, followed by a once-per-minute in-process poll. Each schedule is evaluated against its owner's local calendar date (default Asia/Kolkata); monthly/yearly dates remain anchored to the original schedule day, and an end date is inclusive. Each generated transaction and schedule advance commits in one MongoDB transaction. A deterministic per-occurrence UUID, backed by the existing unique `{ userId, clientId }` transaction index, prevents duplicate generation on retries and concurrent workers. Paused schedules skip dates missed before resumption; failed generation leaves the due date unchanged for retry. The job reports per-schedule failures through process warnings and processes at most 100 overdue occurrences per schedule per pass. MongoDB transaction support (Atlas or a replica set) is required.

Recurring integration tests use an isolated single-node in-memory replica set and cover validation, ownership, schedule lifecycle, daily/weekly/monthly/yearly date calculation, timezone boundaries, generated income/expenses, end dates, failure recovery, concurrency, history and indexes. Run the complete suite with `npm test` from `backend/`.

20. Bank Statement Importer implementation

The authenticated importer is mounted at `/api/imports`. It supports CSV, XLSX and text-based PDF uploads up to 10 MB, stores uploaded files privately with generated storage keys, and limits parsing to 5,000 rows. CSV and XLSX parsers share normalization and mapping logic for common bank column aliases, explicit user-provided column mappings, Indian date formats and grouped rupee amounts. Text PDFs use layout heuristics; scanned/image-only or encrypted PDFs are rejected rather than sent to OCR.

Uploads create a `BankStatementImport` and owner-scoped `StatementTransactionDraft` records; they do not create transactions or change balances. Users can inspect and edit individual rows, mark rows skipped, review duplicate candidates, and explicitly submit selected draft IDs for confirmation. Duplicate checks use only that user's transactions and can match statement reference or amount/date/description. A possible duplicate can only be imported when its draft ID is explicitly included in `allowDuplicateIds`.

Confirmation validates the import's active wallet and any category, then creates confirmed income/expense records through the existing transaction data model. Transaction creation, draft linking, and import status/count updates run in a MongoDB transaction. A unique transaction `statementDraftId` index protects repeated and concurrent confirmation. MongoDB Atlas or a replica set is required. Imported records cannot be deleted by deleting an import.

Endpoints: `POST /api/imports/statements`, `GET /api/imports`, `GET /api/imports/:id`, `GET /api/imports/:id/transactions`, `PATCH /api/imports/:id/transactions/:transactionId`, `POST /api/imports/:id/confirm`, and `DELETE /api/imports/:id`. Configuration uses `STATEMENT_STORAGE_DIR` and `STATEMENT_RETENTION_DAYS`; the cleanup job purges expired private files and non-imported drafts. The storage adapter can be replaced with private cloud object storage.

The Step 7 integration tests use an isolated in-memory replica set and cover CSV/XLSX/PDF parsing, mappings, invalid and oversized files, date/currency normalization, ownership, editing/skipping, duplicates, explicit confirmation, balance updates, repeated/concurrent confirmation, row limits and private-file cleanup. Known limitations are heuristic PDF layout extraction and the variety of bank-specific headings/transaction-direction conventions; users must review all parsed drafts, especially direction and ambiguous rows. The complete backend suite is run with `npm test` from `backend/`.

21. Smart AI Transaction Categorization implementation (2026-11-05)

The authenticated module is mounted at `/api/categorization`. `CategorySuggestion` stores an owner-scoped suggestion separately from the transaction's confirmed `categoryId`; `MerchantCategoryRule` stores one owner/type/normalized-merchant preference. Suggested categories are never applied automatically. Accepting a suggestion or explicitly supplying a correction validates category visibility and transaction type, then updates the transaction and review record in a MongoDB transaction. A correction is recorded as a merchant preference for that user. Existing categories cannot be overwritten.

The engine uses this priority: the user's merchant rule, curated high-confidence merchant/description keywords, same-user confirmed non-trashed history for the same merchant, optional AI, then an uncategorized low-confidence result. Confidence thresholds are high at 0.85–1, medium at 0.60–0.84, and low below 0.60. Low-confidence results have no suggested category and require the user to select one. Historical results are capped at medium confidence.

Available endpoints are `POST /api/categorization/suggest`, `POST /api/categorization/bulk-suggest`, `GET /api/categorization/suggestions`, `POST /api/categorization/:id/accept`, `POST /api/categorization/:id/reject`, and CRUD for `/api/categorization/rules` (`GET`, `POST`, `PATCH /:id`, `DELETE /:id`). Suggest and bulk-suggest have authenticated rate limiting. Bulk requests accept at most 50 unique transaction IDs and use at most three workers; results include independent per-transaction success/error data.

Uncategorized manual transaction creation, receipt/UPI scan confirmation, and statement import confirmation queue a non-blocking suggestion after commit. AI failures, invalid responses and timeouts leave transaction creation unaffected and fall back to rules/history or manual categorization. The optional production provider is an OpenAI-compatible JSON chat-completions endpoint configured with `CATEGORIZATION_AI_PROVIDER`, `CATEGORIZATION_AI_ENDPOINT`, `CATEGORIZATION_AI_API_KEY`, `CATEGORIZATION_AI_MODEL`, and `CATEGORIZATION_AI_TIMEOUT_MS`. It is disabled by default; enabling it requires a server-side key and HTTPS in production. Provider output is validated against categories visible to the transaction owner and type. Requests contain only transaction type, merchant/description text and that user's allowed category IDs/names, not amount, wallet, user ID, or other transaction records. AI cache keys include user ID and permitted category context; provider requests are capped at 30 per user per 15 minutes.

Known limitations: curated keyword rules may miss unfamiliar or ambiguous merchants; history requires a normalized merchant and may not represent a user's intent for a one-off transaction; AI results depend on the configured provider and remain advisory. The provider interface and HTTP adapter are real/configurable in production; tests inject a fake provider. Categorization tests cover rules, history, confidence levels, provider success/failure/invalid IDs, correction learning, ownership, bulk partial failures, existing category preservation, and manual/scan/import integration. Run the full backend suite with `npm test` from `backend/`.

22. Ask Spart Financial Assistant implementation (2026-11-05)

Ask Spart is mounted at `/api/ask-spart` and is strictly read-only. `ChatConversation` and `ChatMessage` store conversations and messages by authenticated owner; all read, rename, and delete queries include that owner. Messages are limited to 2,000 characters, conversations to 200 stored messages, history returned to the caller to 100 messages, and model history to the eight latest prior messages. Chat is limited to 20 requests per authenticated user per 15 minutes. The health endpoint exposes only the assistant name, safe capability list and `ai_enabled`/`rules_only` mode.

The fixed intent router invokes only approved service functions; no model-generated database queries, code, or tools execute. It supports monthly income/expense/net savings and savings rate, month comparisons, category totals/rankings, merchants, wallet balances/activity, recent and current-month transactions, daily/monthly patterns, active budget progress, goal progress, upcoming recurring schedules, and clear out-of-scope responses. Financial context is bounded and intent-specific. Calculations reuse analytics, budget, goal, balance and recurring services; transactions are owner-filtered, confirmed, non-trashed, and transfer legs are excluded from income/expense summaries. All currency amounts remain integer paise until formatted for response text. User timezone is used with Asia/Kolkata as fallback.

The optional OpenAI-compatible provider is disabled by default and configured with `ASK_SPART_AI_PROVIDER`, `ASK_SPART_AI_ENDPOINT`, `ASK_SPART_AI_API_KEY`, `ASK_SPART_AI_MODEL`, `ASK_SPART_AI_TIMEOUT_MS`, and `ASK_SPART_MAX_TOKENS`. The Gemini adapter uses the official `@google/genai` SDK with `ASK_SPART_AI_PROVIDER=gemini`, a server-side `GEMINI_API_KEY` (or legacy `ASK_SPART_AI_API_KEY`), and defaults to `gemini-3-flash-preview`. Missing credentials safely leave rules-based answers active; production OpenAI-compatible endpoints must use HTTPS. Providers receive only the authenticated user's confirmed, bounded financial context and conversation history—not credentials, raw database records, other users' data, or unnecessary transaction fields. Output is validated as bounded JSON, and currency claims must match values in the verified result; failures, timeouts, malformed content and unsupported intents use deterministic verified responses. Recommendation objects are rule-based, separately returned from calculated financial facts. Spart cannot mutate financial records and does not provide investment, tax, or legal advice. Gemini behavior is covered by a mocked SDK request test; live provider activation requires a valid key configured locally and was not verified as part of this change.

23. Anomaly and Fraud Detection implementation (Step 10)

The authenticated module is mounted at `/api/anomalies` and stores findings in a separate MongoDB `TransactionAnomaly` collection. Every transaction and anomaly query is filtered to the authenticated user. Eligible transactions are confirmed, non-trashed income/expense records; transfers and pending-review items are excluded. The module does not modify transactions, balances, budgets, or goals.

Implemented rules detect unusually large expenses against user history, category-specific amount outliers and adjacent 30-day category spending increases, exact/possible duplicates, first-time merchants, merchant amount/spend increases, short-term transaction bursts and frequency increases relative to the prior 28 days, and unusually large amounts within a wallet. Baselines use integer paise and median, 90th percentile and median absolute deviation; amount rules require eight prior observations. New merchants alone are low-severity candidates, not fraud claims. The scoring system is transparent and heuristic (0–100; low 0–34, medium 35–59, high 60–79, critical 80–100), not a calibrated fraud probability.

Endpoints: `POST /api/anomalies/detect` (default 100, maximum 200 transactions; optional inclusive date range up to 90 days), `GET /api/anomalies` (severity/type/status/date filters and pagination), `GET /api/anomalies/summary`, `GET /api/anomalies/:id`, `PATCH /api/anomalies/:id/status`, and `POST /api/anomalies/transactions/:transactionId/check`. Detection checks at most 5,000 same-user records from the preceding year and reports `historyTruncated` if capped. Per-user detection/check requests are limited to 20 per 15 minutes. A compound unique index plus upsert prevents repeat/concurrent duplicate event records while preserving prior review status.

Status values are `new`, `reviewed`, `dismissed`, and `resolved`; updates follow explicit transitions. Anomaly records retain detection time, severity, score, explanation, evidence, related transaction, suggested action and review time. List results are paginated; a separate aggregate summary counts types, severities and statuses. Tests cover rule behavior, thresholds, duplicate idempotency, date/input validation, authentication, user isolation, status updates, listing, and summary. No new environment variables, external services or dependencies are needed.

Known limitations: heuristic thresholds can produce false positives and are not calibrated for fraud probability. Historical baselines may be incomplete for users with limited activity or when the 5,000-record cap is reached. First-time merchant findings are informational; users should check their bank statement and may dismiss records. The engine is not an account-monitoring service and does not contact banks or automatically block/reverse transactions.

24. Expense Prediction Engine implementation (Step 11)

The authenticated prediction API is mounted at `/api/predictions`: `GET /overview`, `/monthly`, `/categories`, `/daily`, and `/accuracy`. Current/next month routes accept validated `month=YYYY-MM`; category/daily routes also accept a validated visible expense `categoryId`; accuracy accepts 3–24 completed months. Requests are limited to 60 per authenticated user per 15 minutes. Predictions are calculated on demand; no prediction collection or cache was introduced.

The model uses only the authenticated user's confirmed, non-trashed expense transactions. Transfers, pending-review entries, and recurring-source transactions are excluded from the historical baseline. The baseline uses at least three active observed months, with a trailing-three-month mean blended 60/40 with earlier available history. Current-month remaining baseline spend is prorated by remaining local calendar days. Daily values divide the monthly baseline evenly across calendar days. Actual month-to-date transactions and future recurring schedules are separate components. Active recurring schedules are projected on due dates, and already-recorded future occurrences are counted once. Existing calendar timezone handling is reused; Asia/Kolkata is the fallback. Seasonal factors are not applied.

Category forecasts use actual default/user-visible expense categories and category-specific transaction history. Categories with fewer than three active historical months return `insufficient_data` and a null predicted amount. Confidence levels describe sample coverage only (low under six active months, medium six to eleven, high twelve or more); they are not accuracy probabilities.

`GET /accuracy` performs a rolling-origin monthly backtest against completed periods. Each forecast uses only transactions dated before its target month; recurring-source expenses are excluded from both forecast and actual metrics. The response includes MAE in integer paise, MAPE for nonzero actual periods, zero-actual period count, and the per-period predicted/actual values. Periods lacking three prior active months are skipped. The metrics are diagnostics, not a guarantee of future performance.

Ask Spart recognizes prediction questions such as “How much might I spend this month?”, “What will my food expenses be next month?” and “Which category may increase?”. It uses the same prediction service and returns verified forecast values with an explicit distinction from recorded actual spending; it remains read-only. Prediction tests cover statistical thresholds, current/next month, dynamic categories, daily results, insufficient history, recurring de-duplication, timezone month boundaries, backtest metrics, user isolation, input validation and Ask Spart. No new dependencies, paid APIs, environment variables, or database model were added.

Known limitations: The model is intentionally simple; it does not apply seasonality or day-of-week factors, and daily baseline allocations are uniform. The minimum-history check is based on active months, while confidence reflects sample coverage rather than calibrated uncertainty. Backtesting evaluates non-recurring spend, so it does not measure recurring-schedule forecast accuracy. Forecasts should not be treated as financial advice or guaranteed outcomes.

25. Subscription Detection Engine implementation (Step 12)

The authenticated subscription module is mounted at `/api/subscriptions` and persists separate MongoDB `Subscription` records. It is not the existing user-created `RecurringTransaction` feature. Detection considers only the caller's confirmed, non-trashed expense transactions over a default five-year window, excludes transactions generated by user-created recurring schedules, and processes at most 5,000 transactions per request. Detection requests are limited to 10 per user per 15 minutes. A compound unique index on owner, normalized merchant and inferred frequency plus upsert provides idempotent detection; repeated runs preserve user status.

Merchant matching reuses `toMerchantKey` and exact normalized merchant strings. Adjacent date intervals are matched to weekly (7 ± 2 days), monthly (30.44 ± 5), quarterly (91.31 ± 14), or annual (365.24 ± 35) intervals. At least two payments are required, so a one-off charge cannot be classified. Score components are occurrence count (20%), interval consistency and fit (35%), amount similarity (25%), exact merchant identity (10%), and regularity (10%). Scores run 0–100; high is 85–100, medium 60–84, low below 60. The score is a transparent pattern-strength indicator, not proof of an active subscription or a calibrated probability. Moderate variable amounts are accommodated using median absolute deviation.

Records keep merchant/category, average integer-paise amount, last/estimated next payment dates, frequency, score/level, evidence snapshots (transaction IDs, dates, amounts and intervals), and status (`detected`, `confirmed`, `dismissed`, `cancelled`). Dismissed/cancelled findings remain historical. Confirmation is explicit; detection never creates wallet transactions, recurring schedules or balance changes. List supports status, frequency, confidence, merchant, date, and pagination filters. Summary cost totals and merchant/category breakdowns keep confirmed and detected records separate; only confirmed items contribute to the headline monthly/annual confirmed cost. Weekly, monthly, quarterly and annual amounts are normalized using 52/12, 1, 1/3 and 1/12 monthly factors respectively. Upcoming dates advance from observed average intervals and are estimates, not guarantees.

Endpoints: `POST /api/subscriptions/detect`, `GET /api/subscriptions`, `GET /api/subscriptions/summary`, `GET /api/subscriptions/:id`, `PATCH /api/subscriptions/:id`, `PATCH /api/subscriptions/:id/confirm`, `/dismiss`, `/cancel`, and `GET /api/subscriptions/:id/history`. `GET /api/analytics/subscriptions` exposes the same summary without changing income/expense calculations. Ask Spart supports count, monthly/annual cost, detected-but-unconfirmed, regular merchant, and upcoming-renewal questions using deterministic service results. Expense predictions exclude confirmed subscription evidence from the baseline and add due confirmed subscriptions separately; an active matching user-created recurring schedule takes precedence. Detected-but-unconfirmed subscriptions are not forecast. Prediction backtests retain their existing non-recurring historical metric scope.

Security uses authenticated routes and owner-specific filters for subscription and category access; category edits accept only shared or user-owned expense categories. History returns the saved evidence snapshot, not broad transaction records. Tests cover frequency classification, variable amounts, inconsistent/one-off patterns, merchant separation/normalization, API validation and ownership, lifecycle transitions, idempotency, history pagination, paise cost conversions, upcoming estimates, analytics exposure, Ask Spart and prediction de-duplication.

Known limitations: The engine groups only exact normalized merchant names, so merchant aliases may be missed while exact-name collisions remain possible. Sparse history can produce low-confidence candidates and false positives. A confirmed record is user-asserted, not merchant-verified; renewal dates can be wrong if billing cadence changes or a subscription ends outside SmartSpend.

Endpoints: `POST /api/ask-spart/chat`, `GET /api/ask-spart/conversations`, `GET /api/ask-spart/conversations/:id`, `PATCH /api/ask-spart/conversations/:id`, `DELETE /api/ask-spart/conversations/:id`, and authenticated `GET /api/ask-spart/health`. Current question routing is English, calendar summaries are month-based, and recurring context uses a 30-day horizon; arbitrary user date ranges and financial actions are not supported. Tests use an isolated in-memory MongoDB replica set and a fake provider; they cover timezone-aware totals, transfer/trash/user exclusion, query intents, budgets/goals/recurring context, provider success/failure/timeout and malformed output, chat lifecycle, rate limits, prompt injection, and ownership. No paid credentials or new dependencies are required. Non-numeric AI wording remains advisory and a provider may be unavailable; `answerSource` distinguishes deterministic answers from model-formatted answers.

26. Financial Health Score implementation (Step 13)

The authenticated routes `GET /api/financial-health/score` and `GET /api/financial-health/breakdown` calculate the same owner-scoped result on demand. No score-history model or `/history` endpoint was added, avoiding redundant snapshots of a result that can be deterministically recalculated. Requests are limited to 30 per user per 15 minutes. Calculation does not write or modify transactions, wallets, budgets, goals, subscriptions, or recurring schedules.

The covered period is the last three completed calendar months in the user's timezone (Asia/Kolkata fallback). Transaction aggregation includes only the user's confirmed, non-trashed income and expense entries; transfers and pending-review records are excluded. Income-versus-expenses and savings-rate dimensions require at least two active transaction months and two transactions. Budget adherence reuses `getBudgetProgress` for completed budgets in the period; savings-goal progress reuses `getGoalProgress` for active goals. Both samples are bounded to 200 records. Active recurring expense schedules are bounded to 1,000 records and converted to monthly paise (daily × 365.25/12, weekly × 52/12, monthly unchanged, yearly ÷ 12).

Confirmed subscription monthly costs reuse the subscription summary. A confirmed subscription merchant matching an active recurring expense schedule via `toMerchantKey` is excluded from subscription burden; the recurring schedule remains represented in the recurring-obligations dimension. Spending consistency compares observed expense totals over the three completed months and reports variability and first-to-last change.

The rule-based overall score is 0–100. Base weights are income versus expenses 20%, savings rate 20%, budget adherence 15%, active savings-goal progress 10%, subscription burden 10%, recurring obligations 10%, and spending consistency/trends 15%. Only supported dimensions participate, and their weights are normalized to 100%; missing data does not directly reduce the score. Grades are `excellent` (85–100), `good` (70–84), `fair` (50–69), and `needs_attention` (0–49). If no dimension is supported, the score is `null` and grade is `insufficient_data`. Dimension results include scores, normalized weights, explanations, paise-based supporting figures, and suggestions when scores indicate room for improvement. Evidence confidence reports transaction count, active months, and sample level; it is not confidence that the score predicts future outcomes.

Ask Spart recognizes health-score, low-score, positive-habit, and improvement questions. The service result and answer are deterministic, and the health intent bypasses the optional LLM to prevent invented scores or figures. Tests cover dynamic weights, insufficient history, missing income, zero expenses, budgets, goal progress, paise totals, excluded transaction classes, recurring/subscription de-duplication, authentication/ownership, and Ask Spart.

Known limitations: The score describes only information recorded in SmartSpend. It does not estimate debt, credit history, assets, emergency reserves outside recorded goals, or unrecorded spending, and it is not a guarantee of financial security or financial advice. Budget and goal dimensions measure currently available records; the score is not a calibrated measure of long-term financial wellbeing. Score history is not persisted.

27. Notification and Alert System implementation (Step 14)

The authenticated API is mounted at `/api/notifications`: `GET /`, `/unread-count`, `/:id`; `PATCH /:id/read`, `/read-all`; and `DELETE /:id`, `/`. List filters include type, severity and read state with pagination. A separate Mongoose `Notification` model stores owner, presentation text, related entity, severity, read state, metadata, deduplication key and expiry. A unique owner/deduplication index ensures idempotent upserts; lookup indexes support feeds and unread counts, and a TTL index expires records after 90 days. All API reads and mutations are restricted to the authenticated user; API requests are limited to 120 per user per 15 minutes.

The existing in-process interval-job pattern is used without adding dependencies. Notification detection runs every 15 minutes in process-local cursor batches of at most 100 users. Per-user inputs are bounded (200 budgets, 100 upcoming schedules, 50 recent detected subscriptions, 100 recent high/critical anomalies, 200 goals, and 500 active recurring expense schedules). Repeated runs are safe because event keys are stable and upserts are atomic. Budget progress reuses `getBudgetAnalytics`/`getBudgetProgress`; upcoming recurring schedules and subscription costs/dates reuse the recurring and subscription services; goal milestones use `getGoalProgress`; spending increases use `getPeriodComparison`.

Events include budget progress at 80% and 100%; upcoming recurring schedules and subscription renewal estimates within three user-local calendar days; recently detected subscriptions needing review; goal completion and 25%, 50%, and 75% progress milestones; newly detected high/critical anomalies; and a significant current-month spending increase (at least 50% and INR 1,000 above the prior month, evaluated from local day 20 onward). Matched active recurring schedules take precedence over a subscription renewal alert with the same normalized merchant and compatible cadence. The recurring-generation job creates a deduplicated failure alert after a generation attempt fails; notification errors are caught separately and cannot undo the completed financial operation.

Financial-health change alerts are intentionally omitted because historical scores are not persisted, so the system cannot reliably compare score changes. The system sends only in-app records; email, SMS and push delivery are not implemented. It does not alter source financial records. Known limitations include in-process scheduling and cursor state (which resets on process restart), a maximum of 100 accounts per job interval, and generation-failure notifications not proving that a bank payment failed. Tests cover record expiry/deduplication, user isolation, pagination and filters, read/unread/delete operations, budgets, recurring/subscription de-duplication, goals, anomalies, spending increases, timezone handling, background-job idempotency, and failure isolation.

Step 18 frontend acceptance check (2026-11-13): the protected page is linked from desktop and mobile navigation, uses the authenticated list/count/read/read-all/delete/delete-all APIs, supports the backend's type/severity/read-state filters and pagination, refreshes the unread badge, formats dates using the user's timezone, links supported event types to existing routes, and provides loading, empty, retryable error and action-feedback states. The backend currently generates `budget_approaching`, `budget_exceeded`, `recurring_upcoming`, `recurring_failed`, `subscription_upcoming`, `subscription_detected`, `goal_reached`, `goal_milestone`, `anomaly_detected`, and `spending_increase` events. It has no preferences API, real-time delivery, date filter, transaction/security notification event, or separate total/read-count endpoint; the frontend does not simulate these. **Not fully complete against the supplied Step 18 checklist:** the page does not present distinct overall-total, unread, and read counts; its visible total follows the active list filters, and only the unread count is separately available. Browser verification of the protected page still requires an authenticated session.

28. Offline Support and Data Synchronization implementation (backend Step 15; frontend Step 19)

The authenticated synchronization API is mounted at `/api/sync`: `POST /push`, `GET /pull`, and `GET /status`. Push accepts up to 50 independently validated operations and caps each serialized operation at 16 KB. Supported entity operations are transaction `create`, `update`, and `delete`; wallet/category edits, receipt/statement files, and frontend offline storage are not synchronized.

`SyncOperation` stores the authenticated owner, client operation ID, operation/entity types, payload, client/server timestamps, result, status, conflict details, fingerprint and processing time. A unique `(userId, clientOperationId)` index makes retries idempotent. The transaction mutation and its operation receipt commit in one MongoDB transaction; therefore the deployment must support replica-set transactions (MongoDB Atlas does). Transactions keep integer-paise amounts and derived wallet balances; no separate balance updates are applied. A transaction creates with its operation ID as `clientId`, reusing the existing per-user unique index.

Updates and deletes require `baseUpdatedAt`; a version mismatch returns `stale_update` with the current server version/data. Attempts to edit deleted records, unavailable wallets/categories, foreign transaction IDs, and transfer edits return explicit conflicts rather than overwriting server state. Deleting a transfer soft-deletes both legs in the same transaction. Pull returns owner-scoped records, including deleted tombstones and current status, using an opaque cursor with a server timestamp watermark and stable `(updatedAt, _id)` page position. Transaction sync APIs are rate-limited to 120 requests per authenticated user per 15 minutes.

Eight targeted tests use a one-node MongoDB replica set and cover batch partial failures, create/update/delete, duplicate retries and operation-ID reuse, stale/deleted conflicts, wallet/category availability, transfer-pair deletion, balance integrity, cursor pagination, user isolation, status counts, and rollback when receipt persistence fails. At Step 15 completion, the full backend suite passed 155 tests. Production sync needs MongoDB Atlas/replica-set transaction support. Operation payloads/results remain stored for idempotent retries and no cleanup policy is configured. A persisted conflict is immutable for that operation ID; clients must submit a rebased operation with a new ID.

Step 19 frontend acceptance: a user-scoped IndexedDB queue stores transaction create/update/delete operations with stable client operation IDs; queue state, retry count/backoff and pull cursor are persisted locally. Online creates use the sync API so retrying the same operation remains idempotent; offline updates/deletes require a known server `updatedAt` and only one queued mutation per entity is allowed. Batches follow the existing 50-operation/16 KB backend limits. Per-operation success removes only accepted items; transient failures retain them with backoff, expired authentication pauses them without deleting data, and conflicts/permanent validation failures remain available for review/discard in the protected `/sync` centre. Sync runs on demand, when connectivity returns, on app visibility, and on retry timers. Pending creates appear in transaction UI but are explicitly excluded from confirmed totals until accepted. Logout preserves the queue and warns the user; records are separated by authenticated user ID.

The service worker provides an offline navigation fallback and caches same-origin static app assets only; it never caches `/api/` responses or credentials. IndexedDB does store queued transaction details, limited owner-scoped wallet/category reference snapshots and sync metadata. The feature does not implement offline transaction-history reads, broad API data caching, wallet/category mutations or file synchronization, merge resolution, or an installable PWA manifest. A successful pull advances the server cursor and invalidates normal queries, but does not persist pulled transaction snapshots. These are explicit scope limitations, not simulated functionality. Step 19 focused frontend validation passed 52 tests across storage, sync result handling/retries/conflicts/authentication, service-worker registration, Sync Centre, offline status, logout preservation, routing, and transaction forms/Quick Add/mutations. The 309-test full frontend suite, warning-free lint, production build, eight backend sync tests and `git diff --check` passed. Authenticated browser/offline-device checks remain pending.

29. Security Hardening and Production Deployment Preparation (Step 16; historical validation snapshot)

The backend security review found one medium-confidence/high-confidence configuration flaw: Ask Spart's API key and HTTPS checks were nested under the categorization-provider condition. This was fixed so enabling Ask Spart independently requires its own key and, in production, an HTTPS endpoint. Regression tests verify each condition while categorization AI remains disabled.

Production environment validation now requires a valid URL for `CLIENT_URL`, an HTTPS frontend origin, distinct JWT secrets of at least 32 characters, and independently configured AI keys/HTTPS endpoints. Error responses in production remain generic; logs contain structured error metadata without raw messages, stacks, request bodies, or query strings. Unknown-route responses no longer echo user-supplied query strings. SIGINT/SIGTERM handling stops scheduled jobs, closes HTTP connections, and disconnects MongoDB; fatal unhandled rejections attempt graceful shutdown. `.env.example` contains placeholders only and repository ignore rules exclude local env files, private storage, build outputs, dependencies and logs.

Dependency overrides update Express's compatible `body-parser` dependency to 2.4.0 and ExcelJS's CommonJS-compatible `uuid` dependency to 11.1.1. The XLSX statement import regression suite passed. At this historical validation snapshot, `npm audit --omit=dev` reported zero vulnerabilities; the full audit retained two moderate development-only findings in `nodemon`/`minimatch`, and no risky major override was applied. The backend suite then passed 158 tests; syntax checks, diff checks, Vercel JSON/build validation, and Render required-field validation passed. The Vercel build had the large-chunk advisory (>500 kB). Re-run tests and audits before releases; these results are not a current release certification.

`render.yaml` prepares Render deployment with `npm ci`, `npm start`, `/api/health/db`, generated JWT secrets, and a persistent disk for private files. `frontend/vercel.json` supports SPA route fallback; Vercel must use `frontend/`, build `npm run build`, output `dist`, and configure `VITE_API_URL`. Configure exact HTTPS `CLIENT_URL`, Atlas TLS/least-privilege/network allowlists/backups, and external secrets before deployment. No deployment was performed. Render YAML required fields were statically checked; no YAML parser or live Render validation is installed/used. The local-file disk is instance-bound, in-process scheduled jobs are not distributed, and the backend currently allows one configured frontend origin; horizontal scaling requires shared private object storage and distributed job coordination.

30. Profile, Settings and Security Management (Step 20)

Backend inspection confirmed that the authenticated account endpoints are `GET /api/auth/me`, `PATCH /api/auth/me`, and `POST /api/auth/logout`. The current-user response includes name, email, optional phone, user type, currency, language, timezone, stored settings and timestamps; the Mongoose JSON transform removes password hashes and refresh-token hashes. The update schema accepts name, phone, user type, timezone, language (`en`, `hi`, `kn`) and nested `autoSaveHighConfidence`, `confidenceThreshold`, `reminderTime`, and `simpleMode`. Email and currency are not updateable. Phone values, when supplied, must be valid Indian mobile numbers; the API does not provide a way to clear an existing number. Timezone is validated as an IANA timezone.

The protected `/settings` page now has Profile, Preferences, Security and Account sections. Profile edits only the supported name, phone, user type and timezone fields using `PATCH /api/auth/me`; email is read-only. Successful responses update AuthContext directly. Field validation follows the backend's name, phone, user-type and timezone constraints; backend field errors are shown inline, submit prevents duplicate requests, and an existing phone cannot be silently cleared. Timezone controls are linked to date/report/notification display and do not alter transaction amounts or stored dates.

Theme (light/dark/system) and effects (Auto/Full/Reduced) remain the existing frontend-only local preferences; theme persistence now safely falls back to the in-session choice if browser storage is blocked. Currency remains INR. Notification preferences are not supported. Although the API stores language and four additional settings, the application does not currently use them, so the page does not present non-functional selectors or switches. The security section displays the returned account creation date and clearly identifies unavailable email-verification, password-change, login-history and remote-session information. Account deletion is not exposed because no endpoint exists. Logout reuses the existing pending-offline-queue confirmation and keeps queued records scoped to the current account.

Authentication/security limitations discovered: password changes and resets, email changes and verification, account deletion, active-session listing and remote sign-out are unsupported. The backend keeps one hashed refresh token per user and rotation replaces it; logout invalidates that stored token only if the server request succeeds. Access JWTs are not individually revocable and remain valid until their configured expiry. There is no last-login or security-event data. No backend code or endpoints were added for Step 20.

Step 20 tests cover profile rendering/editing and AuthContext updates, client/backend validation errors, phone-removal limitation, local theme/effects persistence, explicit unsupported capabilities, account creation date, protected routing, and existing offline-safe logout/navigation behavior. The full frontend suite passed 317 tests across 86 files; the focused settings/auth/navigation run passed 35 tests. Lint passed with zero warnings, the production build passed with the existing >500 kB chunk advisory, and `git diff --check` passed. No backend code changed in Step 20. The subsequent Step 21 authenticated browser run verified profile editing against an isolated test backend; it did not use production services.

31. Performance Optimization and Deployment Readiness (Step 21)

The production-readiness review verified the current Express/Mongoose app, React/Vite router, Axios auth-refresh flow, React Query defaults, user-scoped offline queue, tests, Render/Vercel configuration, and repository ignore rules. Existing account-scoped/date/filter indexes and query pagination/limits are already present across frequently accessed models; no speculative index was added without production query-plan/workload evidence. The frontend already lazy-loads route modules. The current production build still reports a 524.49 kB minified main chunk (166.48 kB gzip); the warning is documented rather than hidden or addressed with arbitrary manual chunk boundaries that would add requests without reducing total bytes.

Backend runtime changes: production Express trusts exactly one Render reverse-proxy hop so IP-keyed authentication/global rate limits can distinguish clients; development and tests do not trust forwarded addresses. Startup now waits for the HTTP listener, MongoDB is explicitly imported for graceful disconnect, startup failures attempt cleanup, and signal shutdown stops in-process jobs, closes HTTP connections, and disconnects Mongoose. Runtime/environment/error logs use structured output and omit tokens, request payloads, query strings, and raw production error messages. `/api/health` is the process liveness check; `/api/health/db` reports database readiness and is used by Render.

Frontend/backend configuration: `frontend/.env.example` contains a local API URL only. Vite development can use its existing `/api` proxy; production builds now fail with a clear error unless `VITE_API_URL` is an absolute HTTPS URL ending in `/api`. This prevents a Vercel SPA fallback from silently returning `index.html` for API calls when the backend URL was omitted. The Axios base URL trims trailing slashes so API and refresh paths stay consistent. The configured backend `CLIENT_URL` must exactly match the deployed frontend origin.

Environment and operation requirements:

- Backend: copy `backend/.env.example` to `.env` for development and set a MongoDB URI plus distinct JWT secrets. Production requires HTTPS `CLIENT_URL`, JWT secrets at least 32 characters long, server-side AI/OCR keys only when their integrations are enabled, and valid storage/retention settings. Standalone env files are ignored and none are tracked directly, but the pre-existing staged `backend.zip` contains an embedded `backend/.env`; its contents were not inspected and it was left unchanged to preserve staged work. Do not commit/share that archive until it is safely sanitized; rotate credentials if the embedded file contains real secrets. Both staged ZIP archives also contain `node_modules`.
- Frontend: copy `frontend/.env.example` for local direct API use, or leave `VITE_API_URL` unset to use the Vite development proxy. For Vercel, configure `VITE_API_URL=https://<backend-host>/api` in the build environment; it is public configuration, not a secret.
- Development: from `backend/`, use `npm ci`, `npm run dev`, and `npm test`; from `frontend/`, use `npm ci`, `npm run dev`, `npm test`, and `npm run lint`.
- Production preparation: Render uses `backend/`, `npm ci`, `npm start`, `/api/health/db`, and a persistent private upload disk. Vercel uses `frontend/`, `npm run build`, `dist`, and the HTTPS API URL above. Atlas must allow the backend's required outbound network, use TLS and a least-privilege user, enable backups, and support replica-set transactions.

The Vercel configuration adds `nosniff`, frame-denial, and strict-origin referrer headers; the backend retains Helmet defaults. A restrictive Content Security Policy was not added because it needs browser validation against the current dynamic routes and upload/report flows.

Automated backend integration tests exercise HTTP requests against isolated MongoDB Memory Server databases, including persistence, validation, authorization/user isolation, uploads/exports, authentication and transactional operations. Frontend component/service tests use mocks, so a separate authenticated browser run was also performed against the real Vite app and Express server using an isolated in-memory replica set. That Step 21 run covered account registration, a paise-backed expense submitted through Quick Add, dashboard totals and transaction visibility after reload, profile editing and persistence after reload, and the Notifications Centre's supported empty state. Desktop and mobile viewport checks showed no horizontal overflow. No production data or paid service was used. Live provider-backed OCR/AI, production Atlas/Render/Vercel, and real-device/network transitions remain unverified; deployment is preparation only, not a completed release. Local file storage remains instance-bound, in-process jobs require coordination before horizontal scaling, only one CORS frontend origin is configured, and the staged backend archive is not safe to commit until its embedded environment file is removed or verified/sanitized. The subsequent Step 22 audit and its limitations are recorded in Section 32.

32. Final End-to-End Audit and Release Readiness (Step 22)

The audit was performed on 2026-11-13 against the local Vite frontend and Express API, backed by a dedicated in-memory MongoDB replica set and isolated test accounts. It did not use production services or real user financial data. Statuses below describe the tested scope, not an assertion that every route or production integration has been exercised.

| Area | Status | Evidence and remaining scope |
|---|---|---|
| Authentication | PASS | Browser verified registration, valid/invalid login, persistence after refresh, protected routing, logout and isolation between two test accounts. |
| Dashboard and wallets | PARTIALLY VERIFIED | Dashboard values persisted; browser created/edited a wallet and transferred ₹100. Wallet archiving and all wallet edge cases were not browser-tested. |
| Transactions | PARTIALLY VERIFIED | Browser verified income/expense totals, persistence, edit, trash/restore and category search. Backend regression tests verify merchant/note/category/wallet search and owner isolation. Full filter/pagination matrix and large-list behavior were not browser-tested. |
| Budgets and savings goals | PARTIALLY VERIFIED | Browser verified a ₹300 Groceries budget against ₹400 spend and a ₹250 contribution to a ₹1,000 goal. Editing and all threshold transitions were not tested. |
| Recurring transactions | PARTIALLY VERIFIED | Browser verified schedule creation, pause/resume and cancellation. The future schedule had no generated transaction yet; generated-history and due-job behavior were not browser-verified. |
| Analytics and exports | PARTIALLY VERIFIED | Browser verified custom date filtering, displayed calculations, and CSV/PDF export responses with expected content types. Every date boundary, wallet activity and recalculation scenario was not tested. |
| Receipt and UPI scanning | PARTIALLY VERIFIED | Backend tests cover upload/draft/duplicate behavior and OCR-provider failure handling. The browser scan flow and live OCR were not tested; no OCR credentials/provider were configured. |
| Bank statement imports | PARTIALLY VERIFIED | Browser imported an isolated CSV after reviewing/correcting its parsed row, explicitly selected it, confirmed import, and acknowledged a detected duplicate on a second import. XLSX/PDF browser flows and multi-row rollback/atomic-failure behavior were not tested. |
| AI and financial intelligence | PARTIALLY VERIFIED | Backend tests cover categorization/Ask Spart provider-unavailable fallbacks and supported intelligence APIs. No live AI provider was configured; live categorization, Ask Spart, anomaly, prediction, subscription and financial-health browser workflows were not verified in this audit. |
| Notifications | PARTIALLY VERIFIED | Browser checked loading/empty state and capability disclosure. Backend tests cover filters, pagination, read/unread, deletion and owner isolation; browser read/delete/navigation actions were not exercised. |
| Settings and security | PARTIALLY VERIFIED | Authentication, protected access and account isolation passed; Step 21 browser checks verified profile editing/persistence. Timezone, appearance, keyboard accessibility and all security failure cases were not re-run in this audit. |
| Offline synchronization | PARTIALLY VERIFIED | Browser network emulation verified a transaction queued in IndexedDB and synchronized after reconnection with one server record and an empty queue. Backend tests cover idempotency, conflicts and user ownership. Retry/conflict UX was not browser-tested; an uncached lazy route could not be opened offline, and real-device behavior remains unknown. |
| Responsive UI | PARTIALLY VERIFIED | At 390, 768 and 1440 CSS-pixel viewport widths, the statement-import page had no horizontal overflow; mobile bottom navigation appeared. Full-page visual review, tablet/mobile form coverage, keyboard and reduced-motion behavior were not completed. |
| Production deployment and live services | NOT TESTED | No Atlas/Render/Vercel deployment or live OCR/AI provider request was performed. |

Audit fixes:

- Transaction search now also matches visible category and wallet names, with a backend regression test for search coverage and cross-user isolation.
- Offline create/update/delete mutations now execute while offline so the queueing path runs instead of leaving React Query mutations paused. Pending operations refresh local queue state without waiting for server refetches; a regression test covers offline cache behavior.

Final automated checks: frontend `npm test -- --run` passed **317/317 tests across 86 files**; backend `npm test` passed **167 tests**; focused offline mutation tests passed **4/4**. Frontend `npm run lint` passed with zero warnings. Production `npm run build` passed with `VITE_API_URL=https://api.example.invalid/api`; the existing main-chunk advisory (524.89 kB) remains. Both `git diff --check` and `git diff --cached --check` passed. No backend lint script is configured.

Security and release decision: user-scoped API behavior was exercised through backend tests and isolated-account browser checks. The staged `backend.zip` contains an entry named `backend/.env`; its contents were not inspected, and the user-directed staged archives were left untouched. Both staged archives include `node_modules`. Treat the backend archive as a release blocker; do not share or commit it until it is safely reviewed and sanitized with explicit approval. This does not establish that the rest of the environment is secret-free. No deployment was performed. **SmartSpend is not ready for release** until the archive risk is resolved and the untested production, provider, multi-format import, and real-device cases are addressed or formally accepted.

Step 22 file changes:

- `backend/controllers/transactionController.js`
- `backend/tests/transactions.test.js`
- `frontend/src/hooks/useTransactionMutations.js`
- `frontend/src/hooks/useTransactionMutations.test.jsx`
- `IMPLEMENTATION.md`

33. Custom Categories, Dashboard Date Selection and Statement Upload Follow-up

Custom categories use the existing authenticated `POST /api/categories` contract. The backend trims and validates the existing 1–40 character name limit, associates each new category with the authenticated user, and rejects case-insensitive duplicates that are visible to that user (including shared defaults). Quick Add and the standard transaction form share the animated category creator; an existing name selects its existing ID, while a new category invalidates category queries and selects the returned category ID. Transaction payloads continue to use `categoryId`, not a free-form name.

The dashboard date control uses a native date picker with explicit month/year display and previous/next month buttons. The selected `YYYY-MM-DD` value is sent to the existing dashboard endpoint as an optional query parameter. Backend date validation and timezone boundary helpers derive the selected calendar day and month using the user's timezone. Selected-day expense totals and selected-month expense/income/category/list results are filtered; wallet balances and latest activity remain all-time. The wallet heading is “Your Current Wallets”; the subtitle is unchanged.

Statement upload continues to send the existing multipart `file`, `walletId` and optional `bankName` fields, with the backend enforcing the 10 MB limit. The Axios request now overrides the shared 10-second timeout with a 120-second statement-specific timeout; timeout failures have a clear retry message. The backend CSV, XLSX and selectable-text PDF parser/integration tests remain the source of format verification. Upload creates review drafts only; transaction creation remains behind the explicit selected-row confirmation.

Feature regression coverage includes user-scoped category creation, case-insensitive duplicate and input validation, use of a custom category ID in a transaction, Quick Add creation/existing-category selection, standard transaction form selection, dashboard selected-date API parameters and leap-day/month-boundary behavior, upload multipart/timeout settings, and statement review/confirmation behavior. Current run-specific test totals, lint/build outcome, browser limitations and remaining issues are recorded in the task report rather than treated as a release certification.

Validation on 2026-11-14: frontend `npm test -- --maxWorkers=1` passed 324/324 tests across 88 files; backend `npm test` passed 173/173 tests. Frontend lint passed with zero warnings. Production frontend build passed with the existing large-chunk advisory (527.79 kB main chunk). `git diff --check` and `git diff --cached --check` passed. Backend statement tests exercised CSV upload-to-review draft creation plus CSV/XLSX/PDF parsing; browser verification and live frontend-to-backend interaction for this follow-up were not performed, and XLSX/PDF were not browser-tested. Desktop/tablet/mobile visual verification remains unperformed.