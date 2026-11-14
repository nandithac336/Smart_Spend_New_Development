import { AuthProvider } from './context/AuthContext.jsx'
import PageTransition from './components/motion/PageTransition.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import PublicOnlyRoute from './components/layout/PublicOnlyRoute.jsx'
import FullScreenLoader from './components/layout/FullScreenLoader.jsx'
import NotFound from './components/layout/NotFound.jsx'
import AppShell from './components/layout/AppShell.jsx'
import { Outlet } from 'react-router-dom'

export const router = [
  {
    HydrateFallback: FullScreenLoader,
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      {
        element: <PageTransition />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('./pages/Landing.jsx')).default,
            }),
          },
          {
            path: '/',
            element: <PublicOnlyRoute />,
            children: [
              {
                path: 'login',
                lazy: async () => ({
                  Component: (await import('./pages/Login.jsx')).default,
                }),
              },
              {
                path: 'register',
                lazy: async () => ({
                  Component: (await import('./pages/Register.jsx')).default,
                }),
              },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                path: 'dashboard',
                lazy: async () => ({
                  Component: (await import('./pages/Dashboard.jsx')).default,
                }),
              },
              {
                path: 'transactions',
                lazy: async () => ({
                  Component: (await import('./pages/Transactions.jsx')).default,
                }),
              },
              {
                path: 'categorization',
                lazy: async () => ({
                  Component: (await import('./pages/Categorization.jsx')).default,
                }),
              },
              {
                path: 'ask-spart',
                lazy: async () => ({
                  Component: (await import('./pages/AskSpart.jsx')).default,
                }),
              },
              {
                path: 'anomalies',
                lazy: async () => ({
                  Component: (await import('./pages/Anomalies.jsx')).default,
                }),
              },
              {
                path: 'scans',
                lazy: async () => ({
                  Component: (await import('./pages/Scans.jsx')).default,
                }),
              },
              {
                path: 'imports',
                lazy: async () => ({
                  Component: (await import('./pages/StatementImports.jsx')).default,
                }),
              },
              {
                path: 'wallets',
                lazy: async () => ({
                  Component: (await import('./pages/Wallets.jsx')).default,
                }),
              },
              {
                path: 'budgets',
                lazy: async () => ({
                  Component: (await import('./pages/Budgets.jsx')).default,
                }),
              },
              {
                path: 'goals',
                lazy: async () => ({
                  Component: (await import('./pages/Goals.jsx')).default,
                }),
              },
              {
                path: 'recurring',
                lazy: async () => ({
                  Component: (await import('./pages/RecurringTransactions.jsx')).default,
                }),
              },
              {
                path: 'analytics',
                lazy: async () => ({
                  Component: (await import('./pages/Analytics.jsx')).default,
                }),
              },
              {
                path: 'predictions',
                lazy: async () => ({
                  Component: (await import('./pages/ExpensePredictions.jsx')).default,
                }),
              },
              {
                path: 'subscriptions',
                lazy: async () => ({
                  Component: (await import('./pages/Subscriptions.jsx')).default,
                }),
              },
              {
                path: 'financial-health',
                lazy: async () => ({
                  Component: (await import('./pages/FinancialHealth.jsx')).default,
                }),
              },
              {
                path: 'notifications',
                lazy: async () => ({
                  Component: (await import('./pages/Notifications.jsx')).default,
                }),
              },
              {
                path: 'sync',
                lazy: async () => ({
                  Component: (await import('./pages/Sync.jsx')).default,
                }),
              },
              {
                path: 'settings',
                lazy: async () => ({
                  Component: (await import('./pages/Settings.jsx')).default,
                }),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]
