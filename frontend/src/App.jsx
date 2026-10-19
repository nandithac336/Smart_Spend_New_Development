import { AuthProvider } from './context/AuthContext.jsx'
import PageTransition from './components/motion/PageTransition.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import PublicOnlyRoute from './components/layout/PublicOnlyRoute.jsx'
import NotFound from './components/layout/NotFound.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import DashboardTemporary from './pages/DashboardTemporary.jsx'

export const router = [
  {
    element: (
      <AuthProvider>
        <PageTransition />
      </AuthProvider>
    ),
    children: [
      { path: '/', element: <Landing /> },
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/register', element: <Register /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/dashboard', element: <DashboardTemporary /> }],
      },
      ...(import.meta.env.DEV
        ? [
            {
              path: '/design',
              lazy: async () => {
                const { default: DesignShowcase } = await import('./pages/DesignShowcase.jsx')
                return {
                  element: (
                    <>
                      <div className="sr-only">Temporary development design showcase</div>
                      <DesignShowcase />
                    </>
                  ),
                }
              },
            },
          ]
        : []),
      { path: '*', element: <NotFound /> },
    ],
  },
]
