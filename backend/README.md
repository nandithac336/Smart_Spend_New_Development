# Smart Spend Backend (Phase 1)

REST API for Smart Spend: auth, wallets, categories, transactions (with trash and undo) and the dashboard.

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

## Test it

```
npm test
```

These tests need no database. They check validation, auth guards, error format and date helpers.
For the full CRUD flow, import `SmartSpend.postman_collection.json` into Postman and run the folders in order.

## Rules built into the code

- Money is stored as integer paise: 12000 = Rs 120.
- `txnDate` is when the purchase happened. `capturedAt` is when it was recorded.
- Transfers move money between wallets and are never counted as income or spending.
- Delete moves a transaction to trash. Restore undoes it.
- Every query is filtered by the logged-in user's id.
- Sending the same `clientId` twice returns the first record, not a duplicate (offline sync safety).
- Errors always look like `{ "success": false, "error": { "code", "message", "details" } }`.
- Today and this month follow the user's timezone (default Asia/Kolkata).

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

Send `Authorization: Bearer <accessToken>` on every route except health, register, login and refresh.

## Not built yet

Password reset email, budgets, goals, recurring bills, receipt scanning and the other later phases.
