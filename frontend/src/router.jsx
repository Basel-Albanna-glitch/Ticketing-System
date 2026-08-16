import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import AgentDetailPage from './pages/AgentDetailPage'
import TodoPage from './pages/TodoPage'
import TodoCreatePage from './pages/TodoCreatePage'
import TodoEditPage from './pages/TodoEditPage'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import GuestTicketPage from './pages/GuestTicketPage'
import GuestTrackPage from './pages/GuestTrackPage'
import RatePage from './pages/RatePage'
import DashboardPage from './pages/DashboardPage'
import TicketsListPage from './pages/TicketsListPage'
import TicketCreatePage from './pages/TicketCreatePage'
import TicketDetailPage from './pages/TicketDetailPage'
import CalendarPage from './pages/CalendarPage'
import CustomersPage from './pages/CustomersPage'
import CustomerProfilePage from './pages/CustomerProfilePage'
import MyAccountPage from './pages/MyAccountPage'
import KbListPage from './pages/KbListPage'
import KbArticlePage from './pages/KbArticlePage'
import AgentsPage from './pages/AgentsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import ProjectsListPage from './pages/ProjectsListPage'
import ProjectBoardPage from './pages/ProjectBoardPage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Registration hidden for now — direct visits redirect to login. Restore the
  // RegisterPage import and this route (plus the login-page link) to re-enable.
  { path: '/register', element: <Navigate to="/login" replace /> },
  { path: '/guest/new', element: <GuestTicketPage /> },
  { path: '/guest/track', element: <GuestTrackPage /> },
  { path: '/rate/:id', element: <RatePage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          {
            element: (
              <ProtectedRoute
                allowedRoles={['customer', 'agent', 'admin']}
                requiredPermission="allow_agent_view_tickets"
              />
            ),
            children: [
              { path: '/tickets', element: <TicketsListPage /> },
              { path: '/tickets/new', element: <TicketCreatePage /> },
              { path: '/tickets/:id', element: <TicketDetailPage /> },
            ],
          },
          { path: '/calendar', element: <CalendarPage /> },
          { path: '/account', element: <MyAccountPage /> },
          { path: '/kb', element: <KbListPage /> },
          { path: '/kb/:id', element: <KbArticlePage /> },
          { path: '/settings', element: <SettingsPage /> },
          {
            element: <ProtectedRoute allowedRoles={['admin', 'agent']} />,
            // The to-do list is its sections, not a page with sections hanging off it:
            // /todo is an entry point that lands on the Inbox rather than a view of its
            // own. `replace` keeps it out of history, so Back does not bounce off it.
            children: [
              { path: '/todo', element: <Navigate to="/todo/inbox" replace /> },
              // Ahead of :view on purpose in the reading, though the router ranks the
              // literal segment first regardless — /todo/new is the add form, not a
              // fifth section of the list.
              { path: '/todo/new', element: <TodoCreatePage /> },
              { path: '/todo/:view', element: <TodoPage /> },
              // Two segments, so it never competes with :view.
              { path: '/todo/:id/edit', element: <TodoEditPage /> },
            ],
          },
          {
            element: (
              <ProtectedRoute
                allowedRoles={['admin', 'agent']}
                requiredPermission="allow_agent_view_customers"
              />
            ),
            children: [
              { path: '/customers', element: <CustomersPage /> },
              { path: '/customers/:id', element: <CustomerProfilePage /> },
            ],
          },
          {
            element: (
              <ProtectedRoute
                allowedRoles={['admin', 'agent']}
                requiredPermission="allow_agent_view_projects"
              />
            ),
            children: [
              { path: '/projects', element: <ProjectsListPage /> },
              { path: '/projects/:id', element: <ProjectBoardPage /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={['admin']} />,
            children: [
              { path: '/agents', element: <AgentsPage /> },
              { path: '/agents/:id', element: <AgentDetailPage /> },
            ],
          },
          {
            // Reports follow the permission rather than the role, so an agent
            // granted it gets in and an admin whose role withholds it does not.
            element: (
              <ProtectedRoute
                allowedRoles={['agent', 'admin']}
                requiredPermission="allow_agent_view_reports"
              />
            ),
            children: [{ path: '/reports', element: <ReportsPage /> }],
          },
        ],
      },
    ],
  },
])

export default router
