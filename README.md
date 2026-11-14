# SmartSpend

An intelligent expense tracking application.

Smart Spend

Smart Spend is a full-stack spending tracker that works as a website and as an installable mobile app (PWA). It is built for students and middle-class users in India, where much of the daily spending is cash or UPI with no printed bill. The core idea: automate what can be automated (receipts, UPI, statements) and make the rest (cash) take about 3 seconds.

Project overview

The project is built in phases. Phase 1 and Phase 2 cover the foundation: authentication, transactions, wallets, budgets and the dashboard. Automation (receipts, statements, screenshots), low-effort cash tracking and intelligence features come in later phases.

Phase 1 and 2 cover:

public landing page
signup, login, logout and password reset
backend authentication API with JWT
MongoDB persistence for all user data
protected routes (each user sees only their own data)
wallets (cash, bank, UPI) with transfers
income and expense transactions with categories and tags
budgets with 80% and 100% alerts
dashboard with live totals
responsive layout: sidebar on laptop, bottom navigation on mobile
Features
Phase 1: Core tracker

Frontend

landing page and public navigation
login and register pages with validation and loading states
dashboard: balance, today's spend, monthly spend, budget remaining, recent transactions
add, edit and delete transactions
"+ Add" button available on every main screen
search and filters (date, category, wallet, amount, tag)
trash and undo for deleted transactions
responsive layout and dark/light theme

Backend

Express API setup and MongoDB connection with health check
user registration and login with JWT
bcrypt password hashing
JWT verification middleware
transactions, wallets and categories CRUD
input validation (Zod or Joi) and rate limiting
safe user responses without password leakage
Phase 2: Full finance app
daily, weekly, monthly and category budgets
charts: category pie, monthly trend, income vs expense
month-vs-month comparison
recurring bills and due-date reminders
savings goals, emergency fund calculator, 50/30/20 salary planner
CSV and PDF export
Phase 3: Automatic capture
receipt scanner: amount, merchant, bill date and time, items, tax, category
payment screenshot reader (PhonePe / GPay success screens)
bank statement import (PDF and CSV)
duplicate detection and linking (the same purchase from two sources becomes one record)
confidence score and review queue
Phase 4: Low-effort cash tracking
quick-add number pad with smart defaults
favorites and presets (Tea ₹20, Auto ₹50)
repeat yesterday's expense
voice entry (English, Hindi, Kannada)
ATM withdrawal creates a cash-in-hand wallet
nightly "where did my cash go?" check-in
unlogged spending bucket, categorized later
merchant memory (correct once, remembered)
Phase 5: Intelligence
explainable, user-specific transaction anomaly detection (implemented in the backend)
statistical expense prediction (implemented in the backend)
subscription detection with user review (implemented in the backend)
financial health score (0 to 100; backend implementation complete)
in-app budget, recurring, subscription, savings-goal and anomaly alerts
Ask Spart: chat that answers only from the user's real data
spending heatmap calendar
Phase 6: App experience and launch
installable PWA (manifest and service worker)
backend transaction push/pull synchronization (implemented; frontend offline queue and service worker remain planned)
push notifications and reminders
PIN or app lock
deployment and testing
India-specific extras (pick 2 to 3)
kirana udhaar (credit) tracker
milk, newspaper and gas cylinder tracker
festival and event budget
roommate and trip expense splitting
tax helper (80C / 80D tags)
Tech stack

Frontend

React
Vite
React Router
Axios
Tailwind CSS
Recharts
PWA (manifest and service worker)

Backend

Node.js
Express
MongoDB with Mongoose (MongoDB Atlas)
bcrypt
JWT
Multer (file uploads)
node-cron (recurring jobs)
Zod or Joi (validation)
dotenv

AI services

vision model for receipts and screenshots
speech recognition for voice entry
LLM for Ask Spart

Deployment

Vercel (frontend)
Render (backend)
MongoDB Atlas (database)
Project structure
SmartSpend/
├─ backend/
│  ├─ config/
│  ├─ controllers/
│  ├─ middleware/
│  ├─ models/
│  ├─ routes/
│  ├─ services/        (OCR, duplicate check, categorization, prediction)
│  ├─ jobs/            (recurring bills, reminders)
│  ├─ tests/
│  ├─ utils/
│  ├─ .env.example
│  ├─ .env
│  ├─ package.json
│  └─ server.js
├─ frontend/
│  ├─ public/          (manifest.json, icons)
│  ├─ src/
│  │  ├─ components/
│  │  ├─ pages/
│  │  ├─ hooks/
│  │  ├─ services/
│  │  └─ sw.js         (service worker)
│  ├─ package.json
│  ├─ vite.config.js
│  └─ index.html
├─ .gitignore
├─ README.md
└─ .env.example
Database collections

Users, Wallets, Transactions, Categories, Budgets, Goals, Recurring, MerchantRules, Receipts, ReviewQueue, SharedGroups

Frontend setup
cd frontend
npm install
npm run dev

The UI runs on the Vite dev server, usually on http://localhost:5173.

Backend setup
cd backend
npm install
copy .env.example .env
npm run dev

The backend normally runs on http://localhost:5000.

MongoDB setup
Create a MongoDB Atlas cluster.
Create a database user and allow your IP address.
Copy the connection string.
Add it to backend/.env.

Example:

PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/smartspend
JWT_SECRET=your_secure_jwt_secret

Important:

never commit .env
keep secrets out of source control
use .env.example as the safe template only
Environment variables
PORT=5000
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=your_generated_jwt_secret
AI_API_KEY=your_vision_and_llm_api_key   (Phase 3 onward)
CLIENT_URL=http://localhost:5173
API endpoints

Health

GET /api/health
GET /api/health/db

Authentication

POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password

Transactions

GET /api/transactions
POST /api/transactions
PUT /api/transactions/:id
DELETE /api/transactions/:id (moves to trash)
POST /api/transactions/:id/restore

Wallets

GET /api/wallets
POST /api/wallets
POST /api/wallets/transfer

Budgets, goals and recurring

GET / POST /api/budgets
GET / POST /api/goals
GET / POST /api/recurring

Automation (Phase 3 and 4)

POST /api/receipts/scan
POST /api/screenshots/scan
POST /api/statements/import
GET /api/review-queue
POST /api/review-queue/:id/confirm
POST /api/cash/reconcile
POST /api/voice/parse

Offline synchronization (backend only)

POST /api/sync/push
GET /api/sync/pull
GET /api/sync/status

Sync is limited to authenticated transaction create/update/delete operations; browser offline storage, service workers, and file sync are not implemented yet.

## Deployment preparation (not deployed)

The root `render.yaml` prepares a Render Node backend with `backend/` as its root, `npm ci` / `npm start`, `/api/health` checks, generated JWT secrets, and a persistent disk for private scan/statement files. Render must have persistent disk support enabled; local upload storage is instance-bound, so horizontal scaling needs shared private object storage and distributed job coordination.

For Vercel, configure the project root as `frontend/`, build with `npm run build`, output `dist`, and set `VITE_API_URL` to `https://<backend-host>/api`. The frontend rewrite configuration is in `frontend/vercel.json`. Configure the backend `CLIENT_URL` to the exact HTTPS frontend origin. Set `MONGODB_URI` to MongoDB Atlas and allow only the Render service's required outbound addresses; enable TLS, least-privilege credentials and backups. Never use public Atlas network access as a shortcut.

No deployment has been performed. Review the backend deployment and security checklist in [backend/README.md](./backend/README.md#production-deployment-readiness-step-16) and configure secrets only in Render/Vercel dashboards, not in committed files.

Current audit status: the production dependency audit is clear; the full development-inclusive audit retains two moderate `nodemon`/`minimatch` findings. No application deployment has been performed.

Offline synchronization (backend only)

POST /api/sync/push
GET /api/sync/pull
GET /api/sync/status

Sync is limited to authenticated transaction create/update/delete operations; browser offline storage, service workers, and file sync are not implemented yet.

Intelligence (Phase 5)

GET /api/predictions/overview
GET /api/predictions/monthly
GET /api/predictions/categories
GET /api/predictions/daily
GET /api/predictions/accuracy
POST /api/anomalies/detect
GET /api/anomalies (filters and pagination)
GET /api/anomalies/summary
GET /api/anomalies/:id
PATCH /api/anomalies/:id/status
POST /api/anomalies/transactions/:transactionId/check
POST /api/subscriptions/detect
GET /api/subscriptions (filters and pagination)
GET /api/subscriptions/summary
GET /api/subscriptions/:id
PATCH /api/subscriptions/:id
PATCH /api/subscriptions/:id/confirm
PATCH /api/subscriptions/:id/dismiss
PATCH /api/subscriptions/:id/cancel
GET /api/subscriptions/:id/history
GET /api/analytics/subscriptions
GET /api/financial-health/score
GET /api/financial-health/breakdown
GET /api/notifications
GET /api/notifications/unread-count
GET /api/notifications/:id
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
DELETE /api/notifications/:id
DELETE /api/notifications
Ask Spart: /api/ask-spart/*

Auth request examples

Register:

json
{
  "name": "Test User",
  "email": "user@example.com",
  "phone": "9876543210",
  "password": "password123"
}

Login:

json
{
  "email": "user@example.com",
  "password": "password123"
}

Protected route header:

Authorization: Bearer <jwt_token>
How receipt automation works
Capture: camera, gallery upload or PDF.
Extract: merchant, total, items, bill date and time.
Validate: do the items add up to the total, is the date plausible, is it a duplicate.
Categorize: use learned merchant rules, ask only if unclear.
Save: high-confidence scans save automatically (with undo); others go to the review queue.
Update: balance, budgets, analytics and alerts refresh.
Laptop vs mobile
	Laptop	Mobile (PWA)
Role	Review, analytics, reports, bulk upload	Quick capture, camera, voice, notifications
Receipt scan	Upload or drag and drop	Camera opens directly
UPI	Statement import	Screenshot share
Offline	Not needed	Add offline, sync later
UPI and automation: honest limits
There is no public API to read PhonePe or GPay history.
UPI spending is captured through payment screenshots, bank statement import and SMS parsing (Android app only, optional).
Account Aggregator (RBI-regulated bank data sharing) is the production roadmap, shown as a sandbox demo only.
Cash cannot be fully automated, so the app makes entry fast and estimates the gap through cash reconciliation.
Important rules
Balance = opening balance + income − expenses
Transfers between own wallets are not counted as spending
Receipt date and upload time are stored separately
Each user can access only their own data (enforced on the server)
No duplicate entries (unique IDs and duplicate checks)
AI answers use only real stored data
Anomaly results are explainable rule scores, not calibrated fraud probabilities; they never modify transactions or balances
Expense forecasts are estimates from historical confirmed expenses, not guarantees; insufficient history returns no forecast amount
Subscription detections are explainable payment patterns, not proof of an active commercial subscription; users confirm them explicitly
Financial health scores are deterministic summaries of recorded data, omit unsupported dimensions and are not guarantees of financial security
In-app notification records are deduplicated and expire after 90 days by default; email, SMS and push delivery are not included
Receipt uploads are validated and kept private
Offline entries sync without loss or duplication
Passwords are stored as bcrypt hashes, never plaintext
How to run the project

Start backend:

cd backend
npm start

Start frontend:

cd frontend
npm run dev
Scope boundaries

Included: Phases 1 to 6, plus 2 to 3 India-specific extras.

Not included (future scope):

live PhonePe / GPay integration
real bank connections in production
iOS SMS capture (not allowed by Apple)
investment trading and loan applications
Android SMS capture, WhatsApp bot and Account Aggregator (optional Phase 7 stretch goals)
Minimum for a strong submission

If time is short, build this:

Phases 1 and 2
Receipt scan with review queue
Quick-add with cash reconciliation
PWA
One intelligence feature (unusual spending alert or month-end prediction)
Notes
.env is ignored by Git
.env.example exists at backend/.env.example
the project starts with the authentication, transactions and dashboard foundation, then adds automation and intelligence phase by phase