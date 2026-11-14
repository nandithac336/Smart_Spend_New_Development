# Smart Spend Backend (Phase 1 + Budgets + Savings Goals + Recurring Transactions + Analytics + Scans)

REST API for Smart Spend: auth, wallets, categories, transactions (with trash and undo), dashboard, budgets, savings goals, recurring transactions, analytics/exports, and receipt/UPI scans.

## Run it

```
cd backend
npm install
copy .env.example .env      (Mac/Linux: cp .env.example .env)
```

Open `.env` and set `MONGODB_URI` (from MongoDB Atlas) and two long random secrets:

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that command twice, once for `JWT_SECRET` and once for `JWT_REFRESH_SECRET`. Then:

```
npm run dev
```

You should see `MongoDB connected` and `Smart Spend API running on http://localhost:5000`.
Check `http://localhost:5000/api/health` and `http://localhost:5000/api/health/db`.

Use MongoDB Atlas (free tier). Wallet transfers use database transactions, which need Atlas or a local replica set, not a plain standalone MongoDB.

## Ask Spart with Gemini

Ask Spart uses the official `@google/genai` SDK on the backend. To enable Gemini, set `ASK_SPART_AI_PROVIDER=gemini`, `GEMINI_API_KEY` to a valid server-side Google AI Studio key, and optionally `ASK_SPART_AI_MODEL=gemini-3-flash-preview` in `backend/.env`. Never put the key in frontend code or commit it. The server sends only the authenticated user's confirmed financial context and keeps the existing verified-data answer as its fallback.

## Test it

```
npm test
```

The API and validation tests run without a database. Integration tests use isolated in-memory MongoDB instances; goals, recurring transactions and scan confirmation use single-node in-memory replica sets for transaction coverage. Tests run serially to avoid competing in-memory MongoDB startup. Tests never connect to the configured application database.
For the full CRUD flow, import `SmartSpend.postman_collection.json` into Postman and run the folders in order.

## Rules built into the code

- Money is stored as integer paise: 12000 = Rs 120.
- `txnDate` is when the purchase happened. `capturedAt` is when it was recorded.
- Transfers move money between wallets and are never counted as income or spending.
- Delete moves a transaction to trash. Restore undoes it.
- Every query is filtered by the logged-in user's id.
- Sending the same `clientId` twice returns the first record, not a duplicate (offline sync safety).
- `/api/sync` adds a durable, transactional operation receipt and conflict-aware transaction sync; it does not add frontend offline storage.
- Errors always look like `{ "success": false, "error": { "code", "message", "details" } }`.
- Today and this month follow the user's timezone (default Asia/Kolkata).
- Recurring occurrences are normal confirmed income or expense transactions and are excluded from transfer semantics.

## Endpoints

| Method | Endpoint | Notes |
|---|---|---|
| GET | /api/health, /api/health/db | Public |
| POST | /api/auth/register | Creates user and a default Cash wallet |
| POST | /api/auth/login | Returns access and refresh tokens |
| POST | /api/auth/refresh | Rotates the refresh token |
| POST | /api/auth/logout | Invalidates the refresh token |
| GET / PATCH | /api/auth/me | Profile and settings |
| GET / POST | /api/wallets | List with live balance, create |
| PATCH / DELETE | /api/wallets/:id | Edit, archive |
| POST | /api/wallets/transfer | Between two wallets |
| GET / POST | /api/categories | Defaults plus your own |
| DELETE | /api/categories/:id | Custom only, if unused |
| GET / POST | /api/transactions | Filters: type, walletId, categoryId, tag, q, from, to, minAmount, maxAmount, page, limit |
| GET / PATCH / PUT / DELETE | /api/transactions/:id | DELETE moves to trash |
| GET | /api/transactions/trash | Deleted items |
| POST | /api/transactions/:id/restore | Undo delete |
| GET | /api/dashboard | Balance, today, month, top categories, recent |
| GET / POST | /api/budgets | List budgets with progress / create a budget |
| GET | /api/budgets/summary | Per-budget progress and summary totals |
| GET | /api/budgets/:id | Read one budget with progress |
| GET | /api/budgets/:id/progress | Refresh a budget's spending progress |
| PATCH / DELETE | /api/budgets/:id | Update / archive a budget |
| GET / POST | /api/goals | List goals / create a goal |
| GET | /api/goals/summary | Savings totals and non-archived goal progress |
| GET | /api/goals/:id | Read one goal with progress |
| PATCH / DELETE | /api/goals/:id | Update / archive a goal |
| GET | /api/goals/:id/progress | Refresh a goal's progress |
| POST / GET | /api/goals/:id/contributions | Add a contribution / list contribution and withdrawal history |
| POST | /api/goals/:id/withdrawals | Withdraw saved amount |
| PATCH | /api/goals/:id/pause, /api/goals/:id/resume | Pause / resume an active goal |
| GET / POST | /api/recurring | List recurring schedules (optional `?status=`) / create |
| GET | /api/recurring/upcoming?days=30 | Active schedules due within the next 1–365 calendar days |
| GET / PATCH / DELETE | /api/recurring/:id | Read / update / cancel a schedule |
| PATCH | /api/recurring/:id/pause, /api/recurring/:id/resume, /api/recurring/:id/cancel | Change schedule status |
| GET | /api/recurring/:id/history | Generated transactions for the schedule |
| GET | /api/analytics/summary | Income, expenses, net savings, savings rate and transaction totals |
| GET | /api/analytics/income-expense | Monthly or weekly income/expense trend |
| GET | /api/analytics/categories | Expense categories; pass `?type=income` for income categories |
| GET | /api/analytics/categories/comparison | Category totals for current and previous periods |
| GET | /api/analytics/wallets | Wallet income, expenses, activity share and current balance |
| GET | /api/analytics/daily | Daily spending, average, highest/lowest spending days (up to 366 days) |
| GET | /api/analytics/monthly | Monthly income and expense trend |
| GET | /api/analytics/merchants | Top expense merchants |
| GET | /api/analytics/comparison | This/previous week, month, year or two custom ranges |
| GET | /api/analytics/budgets, /api/analytics/savings | Budget utilization / savings goal progress |
| GET | /api/export/transactions/csv | Stream a CSV transaction export |
| GET | /api/export/transactions/pdf | Download a PDF financial report |
| POST | /api/scans/receipt, /api/scans/upi | Upload a private receipt or UPI image for OCR review |
| GET / PATCH / DELETE | /api/scans, /api/scans/:id | List, read, edit a draft or delete an owned scan |
| POST | /api/scans/:id/confirm | Explicitly create and link one reviewed transaction |
| POST | /api/anomalies/detect | Detect anomalies for the authenticated user's transactions |
| GET | /api/anomalies | List/filter/paginate owned anomaly records |
| GET | /api/anomalies/summary | Owner-scoped counts by type, severity and status |
| GET | /api/anomalies/:id | Read one owned anomaly |
| PATCH | /api/anomalies/:id/status | Review, dismiss or resolve a finding |
| POST | /api/anomalies/transactions/:transactionId/check | Check one owned confirmed transaction |
| GET | /api/predictions/overview | Current- and next-month forecast summary |
| GET | /api/predictions/monthly?month=YYYY-MM | Forecast current or next calendar month |
| GET | /api/predictions/categories?month=YYYY-MM&categoryId=<id> | Forecast visible expense categories or one category |
| GET | /api/predictions/daily?month=YYYY-MM&categoryId=<id> | Daily actuals and forecasts for current/next month |
| GET | /api/predictions/accuracy?months=12 | Rolling-origin historical backtest metrics |
| POST | /api/subscriptions/detect | Detect owner-scoped merchant payment patterns from up to five years of confirmed expenses |
| GET | /api/subscriptions | Filter and paginate detected/managed subscriptions |
| GET | /api/subscriptions/summary | Confirmed/detected costs, merchant/category breakdowns, and upcoming estimates |
| GET | /api/subscriptions/:id | Read one owned subscription |
| PATCH | /api/subscriptions/:id | Edit merchant, category, amount estimate, frequency, or next-date estimate |
| PATCH | /api/subscriptions/:id/confirm, /dismiss, /cancel | Review a detection or cancel a confirmed subscription |
| GET | /api/subscriptions/:id/history | Paginated payment evidence retained at detection time |
| GET | /api/analytics/subscriptions | Read the same owner-scoped subscription summary alongside analytics APIs |
| POST | /api/sync/push | Push up to 50 independently validated transaction operations |
| GET | /api/sync/pull?cursor=<cursor>&limit=50 | Pull owner-scoped transaction changes with stable cursor pagination |
| GET | /api/sync/status | Read the authenticated user's sync activity summary |

Send `Authorization: Bearer <accessToken>` on every route except health, register, login and refresh.

## Anomaly detection

The authenticated module is read-only with respect to original transactions and wallets. It analyzes only the signed-in user's confirmed, non-trashed income and expense transactions; transfers and pending-review items are excluded. Results are saved in MongoDB as separate `TransactionAnomaly` records. Repeated and concurrent scans are idempotent. A finding never proves fraud and never automatically deletes, blocks, reverses or merges a transaction.

Rules cover unusually large expenses using a personal median/90th-percentile/MAD threshold, exact and possible duplicates, first-time merchants, merchant amount/spend increases, short-term and recent-baseline frequency increases, category amount and spending increases, and unusual wallet amounts. Amount baselines require at least eight prior samples. A first-time merchant alone receives a low score.

Scores range from 0 to 100 and are rule scores, not calibrated fraud probabilities. Severity is low (0–34), medium (35–59), high (60–79) or critical (80–100). Detection/check requests are limited to 20 per authenticated user per 15 minutes. A detection call scans at most 200 target transactions (default 100), at most 90 inclusive calendar days when dates are supplied, and at most 5,000 historical transactions from the preceding year. `historyTruncated` signals when the history cap was reached.

Example request:

```http
POST /api/anomalies/detect
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "startDate": "2026-10-01",
  "endDate": "2026-10-31",
  "limit": 100
}
```

Example response:

```json
{
  "success": true,
  "data": {
    "scannedCount": 1,
    "insufficientBaselineCount": 1,
    "historyTruncated": false,
    "analyzedHistoryCount": 12,
    "anomalies": [{
      "_id": "6735d5f10000000000000001",
      "transactionId": "6735d5f10000000000000002",
      "anomalyType": "large_transaction",
      "score": 64,
      "severity": "high",
      "explanation": "This expense is above your personal historical threshold ...",
      "evidence": { "amountPaise": 500000, "thresholdPaise": 300000, "sampleSize": 10 },
      "status": "new"
    }]
  }
}
```

The complete endpoint set is `POST /api/anomalies/detect`, `GET /api/anomalies`, `GET /api/anomalies/summary`, `GET /api/anomalies/:id`, `PATCH /api/anomalies/:id/status`, and `POST /api/anomalies/transactions/:transactionId/check`. `GET /api/anomalies` accepts `severity`, `type`, `status`, `startDate`, `endDate`, `page` and `limit` (maximum 100). The summary returns counts by severity/type and status. Status updates are constrained to valid review transitions.

Known limitations: deterministic rules may produce false positives or miss fraud. Category and merchant spending compare adjacent 30-day windows; frequency compares short bursts and recent wallet activity against prior activity. Histories are bounded, so high-volume accounts may have truncated history. Users should verify a finding with their bank and may dismiss it; the application does not contact the bank or reverse payments.

## Expense predictions

The authenticated module uses confirmed, non-trashed expense transactions owned by the caller. Transfers, pending-review transactions, and recurring-source transactions are excluded from historical baselines. Money remains in integer paise. Predictions are available for the current or next calendar month in the user's timezone (Asia/Kolkata by default). Category predictions use categories visible to that user, including shared defaults; an optional `categoryId` must refer to a visible expense category. Prediction requests are limited to 60 per authenticated user per 15 minutes.

The statistical method requires three active historical months. It estimates monthly non-recurring expenses from the trailing three-month mean, blended with earlier available history (60% recent / 40% earlier). Current-month remaining baseline spending is prorated by the number of remaining calendar days. Daily forecasts distribute the baseline evenly by day; due active recurring expenses and user-confirmed detected subscriptions are projected separately. Confirmed subscription evidence is removed from the historical baseline. A matching active user-created recurring schedule takes precedence over the detected subscription forecast. Recurring transactions already recorded for a future due date are counted as known scheduled expenses exactly once. No seasonal adjustment is applied. Confidence indicates historical sample coverage, not validated predictive probability. Backtests report the existing non-recurring historical baseline and do not retroactively model subscription confirmation states.

`GET /api/predictions/overview` returns both current- and next-month estimates. `GET /api/predictions/monthly` accepts `month=YYYY-MM` only for the current or next month. `GET /api/predictions/categories` and `/api/predictions/daily` accept the same month and optional category ID. `GET /api/predictions/accuracy` accepts 3–24 recent completed months for rolling-origin backtesting. A backtest prediction for each target month uses only transactions dated before that month; it compares non-recurring forecast and actual amounts. Results include MAE in paise and MAPE only for nonzero actuals. Periods without at least three prior active months are skipped. Zero actuals are counted and excluded from MAPE.

Example:

```text
GET /api/predictions/overview
GET /api/predictions/monthly?month=2026-11
GET /api/predictions/categories?month=2026-12
GET /api/predictions/daily?month=2026-11&categoryId=6735d5f10000000000000001
GET /api/predictions/accuracy?months=12
```

Example response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "forecastPeriod": "2026-11",
    "currency": "INR",
    "predictedAmountPaise": 425000,
    "actualMonthToDatePaise": 180000,
    "remainingExpectedPaise": 245000,
    "dailyAveragePaise": 14167,
    "confidence": { "level": "medium", "historicalSampleSize": 8 },
    "methodology": "Robust bounded rolling monthly averages of confirmed non-recurring expenses; active scheduled expenses are projected separately.",
    "limitations": ["This is a statistical estimate, not a guarantee or financial advice."]
  }
}
```

If fewer than three active months are available, forecast amounts are `null` and status is `insufficient_data`; actual month-to-date values and known recurring commitments remain separate where available. Accuracy metrics are historical diagnostics, not a promise of future performance. Prediction does not modify transactions, wallets, or budgets.

## Remaining roadmap

Password reset email, frontend offline storage/service workers, notifications, and frontend intelligence screens are not part of this backend module.

## Subscription detection

The authenticated module is separate from user-created `RecurringTransaction` schedules. It never creates transactions, schedules, or wallet balance changes. It analyzes only the owner's confirmed, non-trashed expense transactions, excluding expenses created by the recurring-schedule service. The default lookback is five years for annual patterns; a scan processes at most 5,000 transactions and is limited to 10 detections per user per 15 minutes. Repeated scans upsert by owner, normalized merchant, and inferred frequency while retaining `detected`, `confirmed`, `dismissed`, or `cancelled` review status.

Merchant matching uses the existing `toMerchantKey` normalization and exact normalized names, avoiding fuzzy merchant merges. Adjacent date gaps are tested against weekly (7 ± 2 days), monthly (30.44 ± 5 days), quarterly (91.31 ± 14 days), and annual (365.24 ± 35 days) windows. At least two payments and one matching interval are required; inconsistent interval patterns are not stored. Amount variation uses median absolute deviation relative to the median, so moderate price changes can still qualify. The 0–100 explainable pattern score weights occurrence count (20%), interval consistency/quality (35%), amount similarity (25%), exact merchant identity (10%), and regularity (10%). Scores of 85–100 are high, 60–84 medium, and below 60 low. These scores indicate pattern strength, not certainty of an active commercial subscription.

`GET /api/subscriptions/summary` and `GET /api/analytics/subscriptions` report confirmed costs separately from detected-but-unconfirmed estimates. Confirmed monthly/annual costs normalize weekly as 52/12 per month, quarterly as 1/3 per month, and annual as 1/12 per month; detected costs are displayed separately and excluded from confirmed totals. Merchant/category breakdowns use integer paise. Upcoming payment dates are estimates advanced from observed intervals, shown for confirmed and detected records within 30 days, and are not guarantees.

Example requests:

```http
POST /api/subscriptions/detect
Authorization: Bearer <access-token>
Content-Type: application/json

{}
```

```http
GET /api/subscriptions?status=detected&frequency=monthly&confidenceLevel=medium&page=1&limit=20
GET /api/subscriptions/6735d5f10000000000000001/history?page=1&limit=20
PATCH /api/subscriptions/6735d5f10000000000000001/confirm
GET /api/subscriptions/summary
```

Example response:

```json
{
  "success": true,
  "data": {
    "currency": "INR",
    "estimatedMonthlyCostPaise": 12500,
    "estimatedAnnualCostPaise": 150000,
    "activeConfirmedSubscriptions": 1,
    "detectedSubscriptionCount": 1,
    "detected": { "monthlyCostPaise": 5000, "annualCostPaise": 60000 },
    "upcomingPayments": [{
      "merchantName": "StreamBox",
      "expectedPaymentDate": "2026-11-20",
      "estimatedAmountPaise": 12500,
      "frequency": "monthly",
      "confidenceLevel": "high",
      "status": "confirmed"
    }]
  }
}
```

Each stored record keeps payment IDs, dates, amounts, interval/amount evidence, confidence, and review status in MongoDB with a unique owner/merchant/frequency index. Every read and update is owner-scoped; category edits accept only shared or user-owned expense categories. History returns the saved evidence snapshot, not arbitrary transaction fields. Confirm/dismiss/cancel are explicit status transitions. Known limitations include missed/false patterns, exact-name-only merchant grouping, limited statistical calibration, and inability to verify whether a merchant still bills outside the recorded history.

## Financial health score

Authenticated endpoints:

```text
GET /api/financial-health/score
GET /api/financial-health/breakdown
```

The score is calculated on demand; no score history is stored. The period is the last three completed calendar months in the user's timezone (Asia/Kolkata by default). Only confirmed, non-trashed income and expense transactions are counted; transfers and pending-review transactions are excluded. Income and expense dimensions require records across at least two active months; otherwise they are omitted rather than inferred from sparse history.

The deterministic rule score ranges from 0 to 100. Its base weights are income versus expenses 20%, savings rate 20%, budget adherence 15%, active savings-goal progress 10%, subscription burden 10%, recurring expense obligations 10%, and spending consistency/trends 15%. Weights are proportionally normalized over only the dimensions supported by available data; missing dimensions do not reduce the score. Scores at 85, 70, and 50 map to `excellent`, `good`, and `fair`; lower scores are `needs_attention`. When no dimension is supportable the score is `null` with `insufficient_data`.

Budget adherence uses completed budget periods in the analysis window and the existing budget-progress calculation. Goal progress uses active goals and the existing goal-progress rules. Active recurring expense schedules are converted to monthly paise (daily × 365.25/12, weekly × 52/12, monthly × 1, yearly ÷ 12). Confirmed subscription costs use the existing subscription summary; a normalized merchant that also has an active recurring expense schedule is excluded from subscription burden to avoid duplicate obligations. Spending consistency compares observed expense totals for the three months. Subscription and recurring burdens are measured separately; they are not added to actual transaction spending.

Each included dimension returns its normalized weight, score, explanation, supporting figures, and suggestions when appropriate. The result also includes positive habits, areas needing improvement, transaction sample confidence, calculation timestamp, covered dates, and limitations. The score does not account for debt, credit history, assets, emergency funds outside recorded goals, or unrecorded transactions; it is not a guarantee of financial security. Ask Spart answers financial-health questions from this verified service result deterministically and does not ask an LLM to calculate or restate the score.

## Notifications

Authenticated endpoints:

```text
GET    /api/notifications?page=1&limit=20&type=budget_approaching&severity=warning&isRead=false
GET    /api/notifications/unread-count
GET    /api/notifications/:id
PATCH  /api/notifications/:id/read
PATCH  /api/notifications/read-all
DELETE /api/notifications/:id
DELETE /api/notifications
```

Notifications are stored separately in MongoDB with a unique `(userId, deduplicationKey)` index and a TTL index. Records expire after 90 days by default. List and unread-count calls omit expired notifications; reads, updates and deletions are owner-scoped. API access is limited to 120 requests per authenticated user per 15 minutes.

The existing in-process job pattern is reused; no scheduler dependency or external delivery service was added. A notification scan runs every 15 minutes in bounded batches of up to 100 users, with per-user query limits. Repeated/concurrent scans use atomic upserts and the unique key to avoid duplicate alerts. The existing recurring transaction job separately creates a failure alert when schedule generation fails; notification write errors are contained after the financial job has finished.

The scanner detects active budget progress at 80% and 100%, upcoming recurring schedules and subscription renewals within three local calendar days, newly detected subscriptions awaiting review, goal completion and 25/50/75% milestones, new high/critical anomalies, and a significant current-month spending rise (at least 50% and INR 1,000 above the prior month, evaluated from day 20). Active recurring schedules take precedence over a matching subscription renewal alert with the same normalized merchant and compatible cadence. Failed recurring alerts describe a failed transaction-generation attempt; the backend cannot verify whether an external bank payment failed.

Financial health score changes do not generate alerts because score history is not persisted and the application cannot reliably establish a meaningful prior score. Alerts use the user's configured timezone (Asia/Kolkata by default). Detection excludes pending-review and trashed transactions through the existing analytics and budget services. Notifications are in-app records only: this module does not send email/SMS or push notifications, change financial records, or make financial decisions. Delivery requires the backend job to be running; multi-instance job execution is safe for duplicates, while batch cursors are process-local.

## Budgets

Amounts are stored as integer paise. Budget date inputs use `YYYY-MM-DD` user-calendar dates: weekly ranges must be Monday through Sunday, monthly and yearly ranges must cover the full calendar period, and custom ranges may cover any inclusive date span. Progress converts those local dates to timezone-aware UTC instants and sums only the authenticated user's confirmed, non-trashed expense transactions (optionally filtered by an expense category). Income and transfers are excluded.

`DELETE /api/budgets/:id` archives the budget. List and summary endpoints return active budgets by default; pass `?includeArchived=true` to include archived budgets. A budget is approaching its limit at 80% used and exceeded at 100%. Remaining amount may be negative after overspending; percentage remaining is clamped at zero. Summary totals add each budget's allocation and spending, so overlapping all-category and category budgets can count the same expense in more than one budget.

## Savings goals

Goals store an integer-paise `targetAmount` and `savedAmount`, a calendar `targetDate`, optional user-owned active `walletId`, and a status (`active`, `completed`, `paused`, or `archived`). Goal contributions and withdrawals are separate `GoalContribution` ledger records; they do not create transactions or change wallet balances. Each ledger record stores its user, goal, positive paise amount, type, date, and optional note.

Create a goal:

```json
{
  "name": "Emergency fund",
  "description": "Build a reserve",
  "targetAmount": 5000000,
  "targetDate": "2027-12-31",
  "walletId": null
}
```

Add a contribution (withdrawals use the same body at `/withdrawals`):

```json
{
  "amount": 250000,
  "contributionDate": "2026-11-04",
  "note": "Monthly savings"
}
```

Create and contribution responses use the standard `{ "success": true, "data": ... }` envelope. A goal response includes the stored goal and derived `progress` fields: `targetAmount`, `savedAmount`, `remainingAmount`, `percentageComplete`, `isCompleted`, `daysRemaining`, and `requiredMonthlySavings`. An amount-changing response includes both the ledger `contribution` (whose `type` is `contribution` or `withdrawal`) and the updated goal.

Example contribution response:

```json
{
  "success": true,
  "data": {
    "contribution": {
      "type": "contribution",
      "amount": 250000,
      "contributionDate": "2026-11-04T00:00:00.000Z",
      "note": "Monthly savings"
    },
    "goal": {
      "name": "Emergency fund",
      "targetAmount": 5000000,
      "savedAmount": 250000,
      "status": "active",
      "progress": {
        "targetAmount": 5000000,
        "savedAmount": 250000,
        "remainingAmount": 4750000,
        "percentageComplete": 5,
        "isCompleted": false,
        "daysRemaining": 422,
        "requiredMonthlySavings": 339286
      }
    }
  }
}
```

Contributions are allowed only while active and cannot exceed the remaining target. Reaching the target completes the goal. Withdrawals are allowed from active or completed goals, cannot exceed the saved amount, and reopen a completed goal if its saved amount falls below target. Paused and archived goals cannot be changed through contributions or withdrawals. Each balance update and ledger insert runs in a MongoDB transaction, so the deployment must support transactions (Atlas or a replica set). A linked wallet is validated for ownership but does not move money. Monthly savings required is a rounded-up integer-paise estimate over the remaining calendar-month slots; overdue goals report zero.

## Analytics and reports

All analytics and export endpoints require authentication and use the signed-in user's records. Unless dates or a period are supplied, analytics and reports use the current calendar month in the user's timezone (default Asia/Kolkata). Supported query filters are `startDate=YYYY-MM-DD`, `endDate=YYYY-MM-DD` (both required together), `timezone`, `categoryId`, and `walletId`; period comparisons also accept `period=week|month|year|custom`. For custom comparisons use `startDate`, `endDate`, `compareStartDate`, and `compareEndDate`. Custom date ranges are inclusive local calendar dates. Category and wallet filters must belong to the user (or, for categories, be a shared default category). The daily endpoint is capped at 366 days.

```text
GET /api/analytics/summary?period=month
GET /api/analytics/income-expense?period=week&startDate=2026-10-01&endDate=2026-11-04
GET /api/analytics/categories?type=income&startDate=2026-11-01&endDate=2026-11-30
GET /api/analytics/comparison?period=month
GET /api/analytics/comparison?period=custom&startDate=2026-10-01&endDate=2026-10-31&compareStartDate=2026-09-01&compareEndDate=2026-09-30
GET /api/export/transactions/csv?type=expense&startDate=2026-11-01&endDate=2026-11-30
GET /api/export/transactions/pdf?period=month
```

Example summary response:

```json
{
  "success": true,
  "data": {
    "income": 500000,
    "expense": 325000,
    "netSavings": 175000,
    "savingsRate": 35,
    "transactionCount": 12,
    "averageTransactionAmount": 68750,
    "period": {
      "timeZone": "Asia/Kolkata",
      "startDate": "2026-11-01",
      "endDate": "2026-11-30"
    }
  }
}
```

Comparison metrics contain `current`, `previous`, `change`, and `percentageChange`. A `null` percentage means the previous period was zero. CSV requests return a streamed `text/csv` download; PDF requests return an `application/pdf` attachment.

Analytics use confirmed, non-trashed income and expense transactions only; transfers and goal ledger entries are excluded. Monetary values in JSON are integer paise. Savings rate is `(income - expenses) / income * 100`, and is zero if income is zero. Period comparison returns `percentageChange: null` when the previous-period value is zero rather than dividing by zero. Category analytics return totals, transaction counts, percentages, and highest/lowest categories. The wallet endpoint reports period activity and current derived balance. Budget and savings endpoints reuse the existing budget progress and goal summary services.

CSV exports are cursor-backed and streamed in 500-record database batches. They include non-trashed transaction types (including transfer legs and pending-review records), with date/time formatted in the requested timezone and amount formatted as INR. CSV values are quoted/escaped and cells beginning with spreadsheet formula characters are prefixed to prevent formula injection. `type=income` or `type=expense`, `categoryId`, `walletId`, and date filters narrow the export; without date filters it defaults to the current month.

PDF reports use PDFKit and contain the selected date range/timezone, income, expenses, net savings, savings rate, transaction count/average, category breakdown, wallet activity, and a month-over-month comparison. The PDF uses built-in standard fonts and prints currency as `INR`; CSV remains UTF-8 and uses the rupee symbol.

## Receipt and UPI screenshot scans

Scans are private, authenticated drafts. Uploads accept JPEG, PNG, and WebP files up to 5 MB using multipart form field `image`. The backend checks the image signature and basic file structure, stores the file outside the public web root, and processes it through Google Cloud Vision `DOCUMENT_TEXT_DETECTION`. OCR results are editable suggestions only; scanning never creates a transaction or changes a wallet balance. A user must explicitly confirm a draft, which creates one normal confirmed transaction. Wallet balances are derived from that transaction as usual.

Configure these backend environment variables (also listed in `.env.example`):

```env
SCAN_STORAGE_DIR=private/scans
SCAN_RETENTION_DAYS=30
OCR_PROVIDER=google-vision
OCR_API_KEY=your_google_cloud_vision_api_key
OCR_TIMEOUT_MS=15000
```

`OCR_API_KEY` is a Google Cloud Vision API key and must be kept server-side. Uploads can be stored even when OCR is not configured; in that case the API returns a safe error with a `scanId`, and the retained failed scan can be reviewed and completed by editing its draft fields. The local adapter stores generated filenames under per-user directories. The `configureScanStorage` adapter interface (`put`, `get`, `delete`) can be replaced with private cloud object storage. In production, use a persistent private volume or a private object-storage adapter shared by all API instances; do not expose `SCAN_STORAGE_DIR` through static-file serving.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/scans/receipt` | Upload a receipt image (`multipart/form-data`, field `image`) |
| POST | `/api/scans/upi` | Upload a UPI screenshot (`multipart/form-data`, field `image`) |
| GET | `/api/scans?page=1&limit=20&type=receipt&status=ready` | List the signed-in user's scans |
| GET | `/api/scans/:id` | Read one owned scan |
| PATCH | `/api/scans/:id` | Edit draft extraction fields only |
| POST | `/api/scans/:id/confirm` | Explicitly create and link one transaction |
| DELETE | `/api/scans/:id` | Delete the scan and its private image |

Every endpoint requires `Authorization: Bearer <access-token>`. Example upload:

```bash
curl -X POST http://localhost:5000/api/scans/receipt \
  -H "Authorization: Bearer <access-token>" \
  -F "image=@receipt.png"
```

An upload response contains `data.extractionStatus`, editable `data.draftFields`, extracted fields, per-field confidence, warnings, and possible duplicate candidates. If OCR fails, the response is a safe `502` (or `503` if unconfigured); `error.details.scanId` identifies the retained failed draft. A draft can be corrected with fields such as:

```json
{
  "success": true,
  "data": {
    "_id": "675000000000000000000001",
    "type": "receipt",
    "extractionStatus": "ready",
    "draftFields": {
      "merchant": "Corner Store",
      "transactionDate": "2026-11-05T00:00:00.000Z",
      "amountPaise": 1250,
      "currency": "INR",
      "paymentStatus": null
    },
    "confidence": { "overall": 0.91, "fields": { "amountPaise": 0.91 } },
    "warnings": [],
    "possibleDuplicates": []
  }
}
```

The JSON response shape is `{ "success": true, "data": <scan> }`; image storage keys are never returned.

```json
{
  "amountPaise": 1250,
  "transactionDate": "2026-11-05T00:00:00.000Z",
  "merchant": "Corner Store"
}
```

Confirm by selecting the destination wallet, optional category, transaction type and payment method:

```json
{
  "type": "expense",
  "walletId": "64f000000000000000000001",
  "categoryId": "64f000000000000000000002",
  "paymentMethod": "upi"
}
```

The confirmation response is `{ "success": true, "data": <transaction>, "duplicate": false }`; safe retries return the already-created transaction with `duplicate: true`. Potential duplicates are shown on the scan and confirmation is blocked unless the caller explicitly sends `"allowPossibleDuplicate": true`. UPI confirmation requires an extracted or user-reviewed `paymentStatus: "success"` and enforces a reliably detected payment direction. Missing amounts or dates must be supplied in the draft before confirmation.

Image files are removed when a scan is deleted. A bounded cleanup job runs on startup and daily, deleting files and scan records older than `SCAN_RETENTION_DAYS`; failures are reported through process warnings and retried on a later pass. MongoDB transactions are required for confirmation, so the database must be Atlas or a replica set. In a multi-instance deployment, make the storage adapter's delete operation idempotent and ensure instances share the private storage backend. OCR field extraction is heuristic and may miss or misread receipt layouts, regional date formats, line items, or UPI status; users must review all fields. OCR submission sends image content to Google Cloud Vision, so disclose that to users and obtain any required consent.

## Recurring transactions

Schedules store an integer-paise amount, an owner-validated wallet, an optional type-matched category, a user-calendar start/end date, frequency (`daily`, `weekly`, `monthly`, or `yearly`), and status (`active`, `paused`, `completed`, or `cancelled`). Schedule dates are stored as UTC-midnight calendar markers. The optional end date is inclusive. Monthly and yearly schedules preserve their original day anchor (for example, Jan 31 → Feb 28/29 → Mar 31).

Create a schedule:

```json
{
  "name": "Monthly rent",
  "type": "expense",
  "amount": 125000,
  "walletId": "64f000000000000000000001",
  "categoryId": "64f000000000000000000002",
  "description": "Apartment rent",
  "frequency": "monthly",
  "startDate": "2026-11-05",
  "endDate": "2027-10-05"
}
```

The response uses `{ "success": true, "data": ... }`. `amount` is paise, and the response includes `nextDueDate` and schedule status. Generated transactions use `source: "recurring"`, `status: "confirmed"`, `recurringScheduleId`, and a deterministic per-schedule/per-date `clientId`. They flow through the existing balance and dashboard calculations like other confirmed transactions. History is obtained from `GET /api/recurring/:id/history`.

Example create response:

```json
{
  "success": true,
  "data": {
    "name": "Monthly rent",
    "type": "expense",
    "amount": 125000,
    "frequency": "monthly",
    "status": "active",
    "startDate": "2026-11-05T00:00:00.000Z",
    "nextDueDate": "2026-11-05T00:00:00.000Z"
  }
}
```

The server runs an immediate due-processing pass after database connection, then polls once per minute using a non-blocking in-process timer. It compares each due date with that user's local calendar date (default Asia/Kolkata), catches up missed active occurrences in batches of at most 100 per schedule per pass, and writes each transaction and schedule advance in one MongoDB transaction. The unique `{ userId, clientId }` transaction index plus the schedule transaction prevent duplicates across retries and multiple application instances. A replica set (MongoDB Atlas or local replica set) is required.

Local development needs no separate worker command: `npm run dev` starts the API and polling job. In production, run the API with MongoDB transaction support; every API instance may run the poller safely because writes are idempotent and transactional. Job failures emit Node process warnings and leave the due occurrence available for retry on the next pass. Pausing prevents generation; on resume, missed dates are skipped to the next future occurrence rather than backfilled. Deleting a schedule marks it cancelled, preserving its history. No recurring transaction is created directly by the request; processing occurs on the background poll.

Run all backend tests from `backend/` with `npm test`; goal tests use an isolated in-memory single-node replica set.

## Bank statement imports

Statement imports are private, authenticated review drafts. Supported formats are CSV, XLSX, and text-based PDF. Uploads are limited to 10 MB and each statement is capped at 5,000 parsed rows. Uploaded files are stored outside the public web root under generated identifiers and are removed when an unconfirmed import is deleted or when its retention period expires.

Configure storage and retention in the backend environment:

```env
STATEMENT_STORAGE_DIR=private/statements
STATEMENT_RETENTION_DAYS=30
```

The local storage adapter can be replaced with private cloud storage through `configureStatementStorage`; production deployments should use persistent private storage shared by API instances. Do not expose the configured storage directory through static-file serving.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/imports/statements` | Upload a statement with multipart field `file`, selected `walletId`, and optional column `mapping` |
| GET | `/api/imports?page=1&limit=20&status=review` | List the signed-in user's imports |
| GET | `/api/imports/:id` | Read one owned import |
| GET | `/api/imports/:id/transactions?page=1&limit=100` | Review parsed transaction drafts |
| PATCH | `/api/imports/:id/transactions/:transactionId` | Correct a draft or mark it pending/skipped |
| POST | `/api/imports/:id/confirm` | Import explicitly selected draft IDs |
| DELETE | `/api/imports/:id` | Delete an import that has not created transactions |

Example CSV upload:

```bash
curl -X POST http://localhost:5000/api/imports/statements \
  -H "Authorization: Bearer <access-token>" \
  -F "file=@statement.csv" \
  -F "walletId=64f000000000000000000001"
```

For bank-specific headings, the optional `mapping` object maps canonical fields (`date`, `description`, `debit`, `credit`, `amount`, `direction`, `balance`, `reference`) to exact header names, for example:

```json
{
  "date": "Txn Date",
  "description": "Narration",
  "debit": "Withdrawal (INR)",
  "credit": "Deposit (INR)",
  "balance": "Available Balance",
  "reference": "UTR No"
}
```

CSV/XLSX parsing also recognizes common English and Indian bank aliases, Indian date formats, rupee symbols, and Indian digit grouping. When separate debit and credit columns are present, their sign-free amounts determine direction. For a single amount column, map a `direction` column or use a recognized debit/credit indicator in the row; ambiguous direction remains a draft validation error rather than being guessed. A row is never turned into a transaction during upload.

The response follows `{ "success": true, "data": ... }`; monetary draft values such as `amountPaise` and `balancePaise` are integer paise. Draft rows include row number, parsed fields, validation errors, duplicate status/matches, and review status. Correct missing or invalid values before confirmation. Potential duplicates are owner-scoped and matched using a bank reference where available, or amount/date/description. Confirmation requires explicit `draftIds`; possible duplicates must either be skipped or explicitly included in `allowDuplicateIds`:

```json
{
  "draftIds": ["675000000000000000000101"],
  "allowDuplicateIds": []
}
```

Confirmation validates the import owner's active wallet and any selected category, creates regular confirmed income/expense transactions, and records the link back to each draft. Transaction writes and draft status changes use a MongoDB transaction; the unique draft link prevents repeated or concurrent imports. Atlas or a replica set is required. Imported records cannot be removed by deleting the import. The periodic cleanup job removes only expired private files and import drafts that have no imported transactions.

PDF parsing is text-layout heuristic extraction, not OCR; scanned/image-only or encrypted PDFs are rejected. Bank statement PDFs have varied layouts, so parsed rows and inferred debit/credit direction must be reviewed. XLSX uploads reject macro/external-link content and are bounded by archive size/entry limits. Parsing is intentionally conservative: missing dates, amounts, or direction are reported for user correction. Avoid uploading statements containing information not needed for expense tracking.

## Smart transaction categorization

Categorization is owner-scoped and stores suggestions separately from `Transaction.categoryId`. Creating an uncategorized manual transaction, confirming a receipt/UPI scan, or importing a bank statement transaction queues a best-effort suggestion after the transaction commits. Categorization never blocks those writes and never changes the confirmed category automatically. Suggestions may appear shortly after the transaction is created.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/categorization/suggest` | Suggest a category for `{ "transactionId": "..." }` |
| POST | `/api/categorization/bulk-suggest` | Suggest categories for up to 50 `{ "transactionIds": ["..."] }` |
| GET | `/api/categorization/suggestions?page=1&limit=20&status=pending` | List the signed-in user's suggestions |
| POST | `/api/categorization/:id/accept` | Accept a suggestion; optional `categoryId` selects a correction |
| POST | `/api/categorization/:id/reject` | Reject a suggestion; optional `categoryId` records the corrected choice |
| GET | `/api/categorization/rules?page=1&limit=50&transactionType=expense` | List the user's merchant preferences |
| POST | `/api/categorization/rules` | Create or update a merchant preference |
| PATCH | `/api/categorization/rules/:id` | Update an owned merchant preference |
| DELETE | `/api/categorization/rules/:id` | Remove an owned merchant preference |

Example request and response:

```json
POST /api/categorization/suggest
{ "transactionId": "675000000000000000000001" }

{
  "success": true,
  "data": {
    "transactionId": "675000000000000000000001",
    "suggestedCategoryId": "675000000000000000000002",
    "confidence": 0.93,
    "confidenceLevel": "high",
    "source": "keyword_rule",
    "explanation": "Merchant matched a built-in categorization rule.",
    "status": "pending"
  }
}
```

Decision order is: the user's merchant preference, high-confidence built-in merchant/description keywords, that user's confirmed transaction history for the same normalized merchant, then optional AI, and finally manual selection. Confidence is high at 0.85–1.0, medium at 0.60–0.84, and low below 0.60. Low-confidence results do not set a suggested category; the transaction remains uncategorized. A user must explicitly accept or provide a correction. Corrections can create/update the user's merchant preference; rule uniqueness is per user, normalized merchant and transaction type.

Enable the real OpenAI-compatible JSON chat-completions provider with these backend environment variables:

```env
CATEGORIZATION_AI_PROVIDER=openai-compatible
CATEGORIZATION_AI_ENDPOINT=https://api.openai.com/v1/chat/completions
CATEGORIZATION_AI_API_KEY=<server-side secret>
CATEGORIZATION_AI_MODEL=gpt-4o-mini
CATEGORIZATION_AI_TIMEOUT_MS=5000
```

AI is disabled by default; rules and history remain available without credentials or network access. When enabled, only transaction type, merchant/description text and the user's allowed category IDs/names are sent. Amount, wallet, user ID and other transaction records are not sent. Text is treated as untrusted input, output is schema-validated, and suggested/alternative IDs must match a category visible to that user and transaction type. Provider errors or malformed responses fall back to uncategorized; credentials and transaction details are not logged. The default timeout is 5 seconds, and AI requests are capped at 30 per user per 15 minutes. Bulk processing is limited to 50 transactions and three concurrent workers; each result reports success or a per-transaction error.

Known limitations: built-in keyword rules are intentionally conservative and may not recognize every merchant or ambiguous purchase. Historical learning only uses the same user's confirmed, non-trashed transactions and normalized merchant. AI suggestions are advisory and depend on the configured provider's availability and quality; users remain responsible for review.

## Ask Spart (read-only financial assistant)

Ask Spart is a read-only assistant named Spart. A fixed, allowlisted query router identifies supported questions and invokes existing analytics, budget, savings-goal, wallet, and recurring-transaction services. The LLM never receives database access and cannot run generated queries, code, or tools. When the provider is disabled or fails, supported questions still receive deterministic answers from verified financial records; unsupported questions receive a clear scope limitation.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/ask-spart/chat` | Ask a financial question, optionally continuing a conversation |
| GET | `/api/ask-spart/conversations?page=1&limit=20&status=active` | List owned conversations and latest message summaries |
| GET | `/api/ask-spart/conversations/:id` | Read an owned conversation and up to 100 messages |
| PATCH | `/api/ask-spart/conversations/:id` | Rename a conversation using `{ "title": "Monthly review" }` |
| DELETE | `/api/ask-spart/conversations/:id` | Delete the conversation and its messages |
| GET | `/api/ask-spart/health` | Read safe assistant/provider-mode status |

Example request and response:

```json
POST /api/ask-spart/chat
{
  "conversationId": null,
  "message": "How much did I spend this month?"
}

{
  "success": true,
  "data": {
    "conversationId": "675000000000000000000001",
    "message": "Your expenses this month is ₹12,500.00. Net savings are ₹4,300.00 and your savings rate is 25.58%.",
    "financialData": {
      "totalExpensesPaise": 1250000,
      "netSavingsPaise": 430000,
      "currency": "INR"
    },
    "answerSource": "verified_data"
  }
}
```

`conversationId` is optional or `null` to start a new conversation. Messages are trimmed, required, and limited to 2,000 characters. Each user may store up to 200 messages per conversation; provider context is limited to the latest eight messages, and conversation reads return at most 100 messages. Conversations and messages are separately owner-scoped. The chat limit is 20 requests per authenticated user per 15 minutes. A chat response includes raw financial values only as integer paise in `financialData`; `answerSource` is `verified_data`, `verified_data_fallback`, or `ai_with_verified_data`.

Ask Spart supports recorded monthly income/expenses/savings and savings rate, monthly comparisons, category totals and rankings, top merchants, daily/monthly patterns, a bounded recent/current-month transaction list, wallet balances/activity, active budgets and utilization, savings goals, and upcoming recurring schedules (30-day horizon). Transfer, deleted, pending-review and other-user transactions are excluded from income/expense totals; dates use the user's timezone or Asia/Kolkata. Facts come from database records and existing analytics/budget/goal/balance services. Recommendation entries are separately labeled suggestions based on those facts, never guaranteed outcomes. Spart cannot perform financial mutations or provide investment, tax, or legal advice.

Configure the optional OpenAI-compatible chat-completions provider with:

```env
ASK_SPART_AI_PROVIDER=openai-compatible
ASK_SPART_AI_ENDPOINT=https://api.openai.com/v1/chat/completions
ASK_SPART_AI_API_KEY=<server-side secret>
ASK_SPART_AI_MODEL=gpt-4o-mini
ASK_SPART_AI_TIMEOUT_MS=8000
ASK_SPART_MAX_TOKENS=400
```

The provider is disabled safely by default; when enabled, the API key must be configured, and production endpoints must use HTTPS. The configured output token cap is 64–1,200 tokens. Only the user's question, a small intent-specific summary, and up to eight short messages from the same conversation are provided to the model. The AI prompt treats user and transaction text as untrusted; responses must match the expected JSON shape and currency claims must match values in verified context. Invalid responses, unverified monetary claims, provider failures and timeouts fall back to the deterministic answer when available. Provider credentials and raw database documents are never returned or logged. Because language models can still produce misleading non-numeric wording, AI responses remain advisory; use `answerSource` to distinguish them from deterministic responses.

Automated tests inject a fake provider and use isolated MongoDB replica-set test databases; paid credentials are not required. Current natural-language routing is English and calendar analytics are month-based (comparisons use this month versus last month); recurring schedules are summarized for the next 30 days. Spart does not support arbitrary date-range requests or user-defined financial actions in this phase.

## Offline synchronization (backend)

The authenticated API supports transaction synchronization only: `POST /api/sync/push`, `GET /api/sync/pull`, and `GET /api/sync/status`. It does not implement a browser queue, IndexedDB persistence, service workers, receipt/file upload sync, or offline wallet/category mutations.

Push accepts 1–50 operations per request and limits each serialized operation to 16 KB. Every operation is validated independently and receives its own success, conflict, or failure result. Only transaction `create`, `update`, and `delete` are supported. Create accepts the existing transaction fields and integer-paise amount rules; `clientOperationId` is the transaction's unique `clientId`. Update and delete require the server `updatedAt` value as `baseUpdatedAt`. A mismatched version, deleted record, unavailable wallet/category, foreign entity, or attempted transfer edit returns an explainable conflict instead of overwriting server state. Deleting a transfer soft-deletes both transfer legs together.

Each processed or conflict result and its financial change commit in the same MongoDB transaction. A unique `(userId, clientOperationId)` index stores the original result, so retries return the saved result and cannot repeat a balance-affecting write. Reusing an operation ID with different content returns `operation_id_reused`. Invalid and failed operations are not persisted; failed transactions leave neither a transaction change nor a successful receipt, so the client may retry with the same operation ID. This requires MongoDB Atlas or another replica set that supports transactions. Wallet balances remain derived from transactions, so the sync module does not apply a separate balance delta.

Pull returns owner-scoped transaction snapshots and soft-delete tombstones, including current status so pending-review records are not treated as confirmed. Its opaque cursor contains a server-time watermark and pagination position; a completed cursor starts the next incremental window. Repeated boundary records can be returned when MongoDB timestamps have the same millisecond precision, so clients should apply records by entity ID and server `updatedAt`, not append blindly. Sync requests are limited to 120 per authenticated user per 15 minutes. Operation payloads and result snapshots are retained in MongoDB for idempotent retries; no automatic cleanup policy is configured.

The module never trusts client user IDs, validates wallet/category ownership, excludes file/receipt payloads, and does not change existing transaction CRUD behavior. A conflict is persisted as the result for that operation ID; resolving it requires the client to submit a rebased operation with a new ID. Atlas transaction support, idempotent retries, optimistic conflicts, partial batches, tombstones, pagination, user isolation, and balance integrity are covered by 8 isolated replica-set tests. The final backend suite passes 155 tests.

## Production deployment readiness (Step 16)

Deployment is not performed by this repository workflow. The root `render.yaml` defines a Node web service rooted at `backend/`, using `npm ci`, `npm start`, `/api/health`, generated JWT secrets, and a persistent upload disk mounted at `/var/data`. Review Render pricing, service region, outbound network rules, and persistent-disk support before creating the service. A persistent disk is required because scan images and statement files are stored locally; it is instance-bound and does not support horizontal multi-instance file sharing. For multiple instances, move private files to authenticated shared object storage before scaling.

In the Render dashboard, set `MONGODB_URI` to the production Atlas URI, set `CLIENT_URL` to the exact HTTPS Vercel/custom frontend origin, and verify both generated JWT secrets are long and private. Keep optional AI providers disabled unless intentionally configured. Configure Atlas network access for the Render service's outbound IP ranges, enforce TLS, use a least-privilege database user, enable backups, and verify replica-set transactions. Do not allow `0.0.0.0/0` in Atlas merely to make deployment connect.

Vercel uses `frontend/` as the project root, `npm run build` as the build command, and `dist` as the output directory. Set `VITE_API_URL` to the deployed backend API origin plus `/api` (for example `https://<backend-host>/api`) and keep the Vercel/custom domain identical to backend `CLIENT_URL`. `frontend/vercel.json` sends client-side routes to `index.html`. The frontend API does not require the Vite development proxy in production.

Before launch: set production secrets outside source control; verify `.env`, private upload directories, and build outputs are ignored; confirm persistent disk write/read permissions and retention cleanup; ensure CORS allows only the intended frontend origin; verify `/api/health` and `/api/health/db`; run authentication, upload, sync, notification and financial regression tests against a staging replica set; inspect logs for accidental request or payload exposure; and test graceful deploy/restart behavior. The API health check is liveness-only; `/api/health/db` reports database connectivity separately.

Current deployment limitations: no deployment has been run or approved; email/SMS/push services and external monitoring are not configured; local private-file storage requires a single Render instance with persistent disk; in-process jobs can run once per backend instance and need distributed scheduling/locks before horizontal scaling; production CORS currently expects one configured frontend origin; and secrets, Atlas allowlists/backups, custom domains, and Vercel `VITE_API_URL` must be configured in their respective dashboards.

Security and audit results: production validation now requires distinct 32-character JWT secrets and an HTTPS client origin. Ask Spart's API key and HTTPS endpoint are validated independently of the categorization provider. Production API errors return a generic message and log only structured error metadata; unmatched routes do not echo query strings. Graceful `SIGINT`/`SIGTERM` handling stops scheduled jobs, closes HTTP connections, and disconnects MongoDB. `npm audit --omit=dev` reports zero vulnerabilities after compatible overrides for `body-parser` 2.4.0 and ExcelJS's CommonJS-compatible `uuid` 11.1.1. Full `npm audit` still reports two moderate findings in development-only `nodemon`/`minimatch`; no production dependency advisories remain. Review the audit at each release because dependency advisories change.
