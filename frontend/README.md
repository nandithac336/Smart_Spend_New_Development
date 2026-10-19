# Smart Spend Frontend

React 19 and Vite frontend for Smart Spend. The development server proxies
`/api` requests to the backend at `http://localhost:5000`.

## Development

From this directory:

```sh
npm install
npm run dev
```

The temporary home page checks `GET /api/health`. Start the backend before
opening the frontend to see `Backend: ok`.

## Validation

```sh
npm run lint
npm run build
npm test
```
