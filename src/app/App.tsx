import { useEffect } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { ToastProvider, applyTheme, watchSystemTheme } from '../ui'
import { AudioUnlock } from '../audio'
import { useStore } from '../store'
import AppLayout from './AppLayout'
import Dashboard from '../screens/Dashboard'
import Learn from '../screens/Learn'
import CountDrill from '../screens/CountDrill'
import StrategyTrainer from '../screens/StrategyTrainer'
import Deviations from '../screens/Deviations'
import TableGame from '../screens/TableGame'
import BettingSim from '../screens/BettingSim'
import Reference from '../screens/Reference'
import Stats from '../screens/Stats'
import Settings from '../screens/Settings'
import NotFound from '../screens/NotFound'

/**
 * Applies the persisted theme preferences to <html> and keeps them in sync with
 * OS theme changes while the mode is 'system'. Renders nothing.
 */
function ThemeManager() {
  const themeMode = useStore((s) => s.themeMode)
  const colorblind = useStore((s) => s.colorblind)

  useEffect(() => {
    applyTheme(themeMode, colorblind)
  }, [themeMode, colorblind])

  useEffect(() => {
    if (themeMode !== 'system') return
    return watchSystemTheme(() => applyTheme('system', colorblind))
  }, [themeMode, colorblind])

  return null
}

// Hash-based routing keeps deep links and refresh working on any static host
// (e.g. GitHub Pages project sites) with zero server rewrite config.
const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'learn', element: <Learn /> },
      { path: 'drill/count', element: <CountDrill /> },
      { path: 'drill/strategy', element: <StrategyTrainer /> },
      { path: 'drill/deviations', element: <Deviations /> },
      { path: 'play', element: <TableGame /> },
      { path: 'betting', element: <BettingSim /> },
      { path: 'reference', element: <Reference /> },
      { path: 'stats', element: <Stats /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <ToastProvider>
      <ThemeManager />
      <AudioUnlock />
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
