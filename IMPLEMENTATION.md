Smart Spend Implementation Record
1. Project overview

Smart Spend is a full-stack spending tracker that runs as a website and as an installable mobile app (PWA). It targets everyone in India who spends mostly in cash and UPI (students, families, professionals, homemakers, freelancers, small shopkeepers), and reduces manual work by automating receipts, payment screenshots and bank statements, and by making cash entry take about 3 seconds.

This document is the implementation record and technical blueprint. It is written as a plan first. As each item is built, change its status in Section 4 and Section 12 so the document always reflects the actual codebase, not the original intent.

Status as of 2026-10-18: planning complete, no code written yet. Everything below is marked Planned until built and verified.

2. Technology stack
Frontend
React 19 with Vite
React Router
Axios for API requests
TanStack Query for server state and caching
React Hook Form + Zod for forms and validation
Tailwind CSS
Recharts for charts
vite-plugin-pwa (manifest, service worker, share target)
IndexedDB (via idb) for the offline queue
Backend
Node.js + Express
MongoDB Atlas with Mongoose
JWT (access token, plus refresh token)
bcryptjs for password hashing
Zod for request validation
helmet, cors, express-rate-limit
Multer for uploads
node-cron for recurring jobs and reminders
Swagger UI (swagger-jsdoc)
Node test runner + Supertest + mongodb-memory-server for tests
AI services (Phase 3 onward, all behind the backend)
Vision model API for receipt and payment-screenshot extraction
Browser Web Speech API for voice capture, with an LLM parsing the text
LLM for Ask Spart, using tool calls over the user's own data
Deployment
Vercel (frontend), Render (backend), MongoDB Atlas (database)

3. Core design decisions
Decision	Reason
Money stored as integer paise (₹120.50 = 12050)	Avoids floating point errors in totals and budgets
Two timestamps per transaction: txnDate (when the purchase happened) and capturedAt (when it was recorded)	A receipt scanned today may be from yesterday
Transfers are a separate type and are excluded from income and expense totals	Prevents double counting between a user's own wallets
Soft delete (deletedAt)	Powers trash and undo
clientId on every transaction (UUID made on the device) with a unique index per user	Makes offline sync and retries idempotent, so nothing is duplicated
Scans create pending_review transactions until validated or auto-approved	Wrong AI output never silently changes balances
Every user query is filtered by userId on the server	Data privacy cannot depend on the frontend
AI never invents numbers: Ask Spart calls query functions and only explains their results	No fake financial claims
All dates stored in UTC, displayed in the user's timezone (default Asia/Kolkata)	A transaction always lands on the correct day

4. Implementation status
Area	Status
Project setup (folders, Git, env files)	Planned
Auth (register, login, refresh, reset)	Planned
Wallets and transfers	Planned
Transactions CRUD, trash, undo	Planned
Categories	Planned
Dashboard	Planned
Budgets and alerts	Planned
Charts and comparisons	Planned
Recurring bills, goals	Planned
Receipt scan, review queue	Planned
Screenshot reader, statement import	Planned
Duplicate detection	Planned
Quick-add, favorites, voice	Planned
Cash reconciliation	Planned
Intelligence features	Planned
PWA and offline sync	Planned
Deployment	Planned

5. Database design (MongoDB)

All collections include createdAt and updatedAt. All user-owned collections include userId (indexed).

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
deletedAt	soft delete

Indexes: {userId, txnDate:-1}, {userId, categoryId, txnDate}, {userId, walletId}, {userId, clientId} (unique), {userId, dedupeHash}, {userId, upiRef} (sparse), {userId, deletedAt}.

Other collections
Collection	Key fields
Categories	userId (null = default), name, icon, color, type (expense/income)
Budgets	userId, categoryId (null = overall), period (daily/weekly/monthly), amount, month, alertsSent {p80, p100}
Goals	userId, title, targetAmount, savedAmount, deadline, type (normal/emergency)
Recurring	userId, walletId, amount, categoryId, merchant, frequency, nextDate, active, isSubscription, markedUnused
MerchantRules	userId, merchantKey, categoryId, purpose, confirmCount, lastUsed
Receipts	userId, fileKey, mimeType, size, extracted (JSON), confidence, receiptDate, uploadedAt, status
ReviewQueue	userId, receiptId or source, draft (transaction payload), confidence, flags[], status (pending/approved/rejected)
CashCheckins	userId, date, expectedCash, actualCash, difference, resolved
Favorites	userId, label, amount, categoryId, walletId, usageCount
SharedGroups	name, members[{userId, role}], expenses[], settlements[]

6. Backend structure
backend/
├─ config/         db.js, env validation
├─ models/         one file per collection
├─ controllers/    request handling only
├─ services/       business logic (balance, budget, dedupe, receipts, prediction)
├─ middleware/     auth, validate (Zod), rateLimit, upload, errorHandler
├─ routes/         one router per resource
├─ jobs/           recurring.js, reminders.js, subscriptionDetect.js
├─ utils/          money.js, dates.js, merchant.js, apiError.js
├─ tests/
└─ server.js

Rules:

Controllers stay thin. Logic lives in services/ so it can be unit tested.
All input passes through a Zod schema before reaching a controller.
All errors flow through one error middleware and return the same JSON shape.

Response format

json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }

Error codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, DUPLICATE_SUSPECTED, INSUFFICIENT_DATA, FILE_INVALID, RATE_LIMITED, CONFLICT.

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

Treated as a transfer from the bank wallet to the cash wallet, so spending is not counted twice (it is counted when the cash is spent).

7.4 Budget checks

After every confirmed expense:

Sum spending for the matching period and category.
Compare against the budget.
At 80% or more, or 100% or more, create an alert once (tracked in alertsSent) and reset on a new period.
7.5 Receipt pipeline
Upload: Multer, memory storage, 5 MB limit, allow only JPEG, PNG, WebP and PDF. Check the file's magic bytes, not just the extension.
Store: save to private storage. Files are served only through authenticated, short-lived signed URLs.
Extract: send to the vision model with a strict prompt that returns JSON: merchant, total, date, time, items[], tax, paymentMethod, receiptNumber, confidence.
Validate the response with Zod, then check:
items sum to the total (within a small tolerance)
the date is not in the future and not older than 1 year
the total is greater than zero
Confidence score starts from the model's own score and is reduced for each failed check.
Categorize: look up MerchantRules first. Otherwise use the model's suggestion.
Duplicate check (see 7.6).
Route:
Confidence at or above the user's threshold, no duplicate, and auto-save on: save as confirmed, with an undo option.
Medium confidence: create a pending_review item.
Low confidence: ask for a clearer photo or manual entry.
Save both dates: txnDate from the receipt (fall back to capturedAt if unreadable), and capturedAt as the upload time.
7.6 Duplicate detection

Score a candidate against existing transactions from the last 7 days:

Signal	Points
Same upiRef	Definite duplicate
Same receipt number and merchant	Definite duplicate
Same amount	40
Same merchant key	30
Within 10 minutes	20
Within the same day	10
Score 70 or more: flag as likely duplicate and let the user merge or keep both.
Merge means keep one transaction, set linkedTransactionIds, and attach the receipt. The amount is counted once.
7.7 Statement import
Parse CSV directly. For PDF, extract text, then parse rows (or use the vision/LLM extractor for unusual formats).
Normalize each row into the transaction shape (txnDate, amount, debit or credit, narration, UPI ref).
Pull the merchant name from the narration (for example UPI/…/RAJU TEA STALL/…).
Run duplicate detection against existing records, which links rows to receipts or screenshots already saved.
Show all rows in one review screen. Nothing is saved until the user confirms.
7.8 Cash reconciliation
expectedCash = cash wallet balance (from logged transactions)
difference   = expectedCash − actualCash entered by the user

If difference > 0, create an expense with source: reconciliation, isUnlogged: true, category "Unlogged cash". The user can split or recategorize it later. The nightly check-in runs at the user's chosen time.

7.9 Merchant memory

When a user changes a category, increment confirmCount on the MerchantRule. From the first confirmation onward, new transactions from that merchant are suggested with that category. The user can view, edit and reset all rules.

7.10 Intelligence rules (kept explainable, no black box)
Feature	Method
Unusual spending	Flag if the amount is above median + 3 × MAD for that category, with at least 10 past entries. Otherwise do not flag.
Month-end prediction	spent so far + (average daily spend over the last 30 days × days left) + scheduled recurring bills. Show the assumptions and a range, not a single promise.
Subscription detector	Same merchant, similar amount (within 10%), repeating at 7, 30 or 365 day intervals at least 3 times.
Financial health score (0-100)	Weighted: savings rate 35, budget adherence 30, spending consistency 15, emergency fund progress 20. The breakdown is shown to the user.
Daily limit	(monthly budget − spent) ÷ days remaining
Ask Spart	The LLM is given tool functions (getSpendByCategory, getTopExpenses, getBalance, canAfford, and so on) that run server-side queries. The answer is built only from tool results.

8. API surface (all Planned)
Method	Endpoint	Purpose
GET	/api/health, /api/health/db	Health checks
POST	/api/auth/register, /login	Account creation and login
POST	/api/auth/refresh, /logout	Token refresh and logout
GET / PATCH	/api/auth/me	Profile and settings
POST	/api/auth/forgot-password, /reset-password	Password reset
GET / POST	/api/wallets	List and create wallets
PATCH / DELETE	/api/wallets/:id	Edit and archive
POST	/api/wallets/transfer	Move money between wallets
GET	/api/transactions	List with filters and pagination
POST	/api/transactions	Create (idempotent through clientId)
GET / PATCH	/api/transactions/:id	Read and edit
DELETE	/api/transactions/:id	Move to trash
POST	/api/transactions/:id/restore	Undo delete
GET	/api/transactions/trash	List deleted
POST	/api/transactions/bulk	Offline sync batch
GET / POST / PATCH / DELETE	/api/categories	Category management
GET / POST / PATCH / DELETE	/api/budgets	Budget management
GET / POST / PATCH	/api/goals	Savings goals
GET / POST / PATCH / DELETE	/api/recurring	Recurring bills
GET	/api/dashboard	Totals for the dashboard
GET	/api/analytics/category, /trend, /compare, /heatmap	Chart data
GET	/api/export/csv, /pdf	Reports
POST	/api/receipts/scan	Upload and extract one receipt
POST	/api/receipts/batch	Up to 20 receipts
POST	/api/screenshots/scan	Payment screenshot
POST	/api/statements/import	CSV or PDF statement
GET	/api/review-queue	Pending items
POST	/api/review-queue/:id/confirm, /reject	Resolve an item
POST	/api/duplicates/:id/merge	Merge duplicates
GET / POST / DELETE	/api/favorites	One-tap presets
POST	/api/transactions/repeat/:id	Repeat a past expense
POST	/api/voice/parse	Text to transaction draft
POST	/api/cash/reconcile	Record actual cash in hand
GET / DELETE	/api/merchant-rules	View and reset learned rules
GET	/api/insights/summary, /prediction, /health-score, /unusual, /subscriptions	Intelligence
POST	/api/ask	Ask Spart
GET	/api/docs	Swagger documentation
Any unmatched route		JSON 404 handler

9. Frontend design
Routes
Route	Screen	Access
/	Landing	Public
/login, /register, /forgot-password	Auth	Public
/onboarding	"Who are you?", first wallet, opening balance	Private
/dashboard	Totals, budget, recent transactions, insight	Private
/transactions	List, search, filters, trash	Private
/wallets	Wallets and transfers	Private
/budgets	Budgets and goals	Private
/analytics	Charts and comparisons	Private
/scan	Receipt, screenshot and statement upload	Private
/review	Review queue	Private
/ask	Ask Spart chat	Private
/settings	Profile, language, theme, PIN, data export and delete	Private
Layout
Laptop: sidebar navigation.
Mobile: bottom navigation bar.
A floating "+ Add" button on every private screen opens the quick-add sheet.
Quick-add sheet

Number pad first, then category chips, with wallet, date and time pre-filled. Favorites sit above the pad. Voice entry is one tap. Target: a cash entry in under 3 seconds.

Frontend rules
Server data goes through TanStack Query, never copied into local state.
Forms use React Hook Form with the same Zod rules as the backend.
Money is formatted from paise in one shared helper (formatINR).
Every screen has loading, empty and error states.
The token is attached by an Axios interceptor, and a 401 triggers a refresh, then logout if it fails.
Language strings live in i18n files (en, hi, kn).
PWA and offline
manifest.json with icons, and a share_target so screenshots can be shared directly to the app on Android.
Service worker caches the app shell.
Offline entries are stored in IndexedDB with a clientId, then sent to /api/transactions/bulk on reconnect. The unique {userId, clientId} index makes repeated syncs safe.
Conflict rule: server version wins for edits made on another device, and the user is told.

10. Security checklist
 bcrypt password hashing, minimum password rules
 Short-lived access token plus rotating refresh token
 Rate limiting on auth, upload and AI routes
 helmet and a strict CORS origin
 Zod validation on every body, query and param
 userId filter on every database query
 No password hash or token in any response or log
 Upload type, size and magic-byte validation
 Private file storage with signed URLs
 AI API keys only on the server
 Consent shown before receipts go to an external AI service
 Data export and full account deletion
 Optional PIN or app lock
 .env ignored by Git, .env.example committed

11. Environment variables
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=your_generated_jwt_secret
JWT_REFRESH_SECRET=your_generated_refresh_secret
CLIENT_URL=http://localhost:5173
AI_API_KEY=your_ai_api_key
STORAGE_BUCKET=your_private_storage_bucket
EMAIL_HOST=your_smtp_host
EMAIL_USER=your_smtp_user
EMAIL_PASS=your_smtp_password

12. Build phases, with acceptance checks
Phase	Scope	Done when
1	Setup, auth, wallets, transactions CRUD, trash, dashboard, responsive shell	A new user can register, add a wallet, add and delete transactions, and see correct totals
2	Budgets, charts, month comparison, recurring bills, goals, CSV and PDF export	Budget alerts fire once at 80% and 100%, and recurring bills create entries on schedule
3	Receipt scan, screenshot reader, statement import, duplicate detection, review queue	A receipt becomes a correct pending or saved transaction, and a re-upload is flagged as a duplicate
4	Quick-add, favorites, repeat, voice, cash wallet, reconciliation, merchant memory	A cash expense takes under 3 seconds, and a corrected merchant is remembered
5	Unusual alerts, prediction, subscription detector, health score, Ask Spart	Each result can be traced back to stored transactions
6	PWA, offline sync, notifications, PIN lock, i18n, deployment	App installs on a phone, offline entries sync once with no duplicates
7 (optional)	Android SMS capture, WhatsApp bot, Account Aggregator sandbox	Stretch goals only

13. Testing plan

Backend (Node test runner + Supertest + mongodb-memory-server)

Auth: register, duplicate email, login, bad password, protected route, refresh
Ownership: user A cannot read or edit user B's data (must return 404 or 403)
Transactions: validation, clientId idempotency, soft delete and restore
Balance: income, expense, transfer and ATM cases produce the expected wallet balance
Transfers: excluded from spending totals
Budgets: alert at 80% and 100%, only once per period
Duplicate scoring: known examples above and below the threshold
Reconciliation: correct difference and entry
Receipt service: mocked AI responses covering high, medium and low confidence, a bad total, and a future date
Uploads: wrong type, oversized file, and a renamed file are rejected

Frontend

Vitest + React Testing Library for forms, money formatting and protected routes
A final browser run of every main flow (register, add expense, scan, review, offline sync), because passing unit tests do not prove the live app works

Manual before each release

Test on a real phone (camera, install, offline)
Test with blurry, faded and non-English receipts

Run tests serially if they share database state.

14. Known limitations (state these openly)
No public API reads PhonePe or Google Pay history. UPI is captured through screenshots, statement import and optional Android SMS parsing.
Account Aggregator is a roadmap item and sandbox demo only. Production use needs regulatory onboarding.
iOS does not allow SMS reading, and a PWA cannot read SMS on any platform.
Cash cannot be fully automated. The app reduces effort and estimates the gap through reconciliation.
OCR and AI extraction can be wrong, so every scan carries a confidence score and uncertain items need review.
Predictions are estimates based on past behavior and are shown with their assumptions.

15. Immediate next steps
Create the folder structure, Git repository and .env.example files.
Connect the backend to MongoDB Atlas and confirm /api/health/db.
Build the User model, register, login and JWT middleware, with tests.
Build Wallet and Transaction models and CRUD, with the ownership tests.
Build the frontend auth screens and protected routes, then connect them to the live API.
Build the dashboard from real data, never mock data.

Lesson to apply from day one: connect each screen to the live API as soon as its endpoint exists, and verify it in a browser. Do not let mock data stay in the frontend after the backend is ready.

16. Final note

The project is in the planning stage. This record should be updated after every phase so that the status table, API table and limitations always describe what actually exists in the code.