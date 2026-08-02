import { Suspense, lazy, type ComponentType } from 'react'

import { Shell } from './components/layout/Shell'
import { Button, Icon, Skeleton } from './components/ui'
import { useRoute } from './lib/router'
import { useStore } from './lib/store'

/* The dashboard is eagerly loaded — it is the landing route and the one page
   that should never show a skeleton. Everything else splits into its own chunk,
   so opening the app pulls a fraction of the code. */
import { Dashboard } from './pages/Dashboard'

const Achievements = lazy(() => import('./pages/Achievements').then((m) => ({ default: m.Achievements })))
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })))
const Applications = lazy(() => import('./pages/Applications').then((m) => ({ default: m.Applications })))
const Courses = lazy(() => import('./pages/Courses').then((m) => ({ default: m.Courses })))
const InterviewPrep = lazy(() => import('./pages/InterviewPrep').then((m) => ({ default: m.InterviewPrep })))
const Journal = lazy(() => import('./pages/Journal').then((m) => ({ default: m.Journal })))
const LearningPath = lazy(() => import('./pages/LearningPath').then((m) => ({ default: m.LearningPath })))
const Leverage = lazy(() => import('./pages/Leverage').then((m) => ({ default: m.Leverage })))
const LinkedIn = lazy(() => import('./pages/LinkedIn').then((m) => ({ default: m.LinkedIn })))
const Networking = lazy(() => import('./pages/Networking').then((m) => ({ default: m.Networking })))
const Portfolio = lazy(() => import('./pages/Portfolio').then((m) => ({ default: m.Portfolio })))
const Progress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Progress })))
const Readiness = lazy(() => import('./pages/Readiness').then((m) => ({ default: m.Readiness })))
const Reading = lazy(() => import('./pages/Reading').then((m) => ({ default: m.Reading })))
const Roadmap = lazy(() => import('./pages/Roadmap').then((m) => ({ default: m.Roadmap })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const Skills = lazy(() => import('./pages/Skills').then((m) => ({ default: m.Skills })))
const Writing = lazy(() => import('./pages/Writing').then((m) => ({ default: m.Writing })))

/** Route table. Mirrors the nav registry in `lib/nav.ts`. */
const ROUTES: Record<string, ComponentType> = {
  '/': Dashboard,
  '/learning-path': LearningPath,
  '/roadmap': Roadmap,
  '/skills': Skills,
  '/readiness': Readiness,
  '/reading': Reading,
  '/courses': Courses,
  '/portfolio': () => <Portfolio scope="all" />,
  '/case-studies': () => <Portfolio scope="case-studies" />,
  '/ai-projects': () => <Portfolio scope="ai" />,
  '/writing': Writing,
  '/interview-prep': InterviewPrep,
  '/networking': Networking,
  '/linkedin': LinkedIn,
  '/applications': Applications,
  '/analytics': Analytics,
  '/leverage': Leverage,
  '/achievements': Achievements,
  '/progress': Progress,
  '/journal': Journal,
  '/settings': Settings,
}

function Boot() {
  return (
    <div className="boot">
      <div className="boot__logo">CC</div>
      <div className="boot__spinner" />
      <div className="boot__body">Loading your career data…</div>
    </div>
  )
}

function BootError({ message }: { message: string }) {
  return (
    <div className="boot">
      <div className="boot__logo">CC</div>
      <div className="boot__title">Could not load your data</div>
      <p className="boot__body">{message}</p>
      <div className="boot__code">npm run seed</div>
      <p className="boot__body text-tertiary">
        That writes the eighteen JSON files into <code>data/</code> without overwriting anything that already
        exists.
      </p>
      <Button variant="primary" icon={<Icon name="refresh" size={14} />} onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  )
}

/** Shown for the moment a lazily-loaded page chunk is in flight. */
function PageSkeleton() {
  return (
    <div className="page">
      <div className="col" style={{ gap: 'var(--space-3)' }}>
        <Skeleton width={280} height={30} radius={8} />
        <Skeleton width="min(680px, 100%)" height={14} radius={6} />
      </div>
      <div className="grid grid--auto-sm">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={82} radius={12} />
        ))}
      </div>
      <div className="grid grid--auto-lg">
        <Skeleton height={280} radius={12} />
        <Skeleton height={280} radius={12} />
      </div>
    </div>
  )
}

function NotFound({ path }: { path: string }) {
  return (
    <div className="page">
      <div className="boot" style={{ minHeight: '50vh' }}>
        <div className="boot__title">Nothing here</div>
        <p className="boot__body">
          <code>{path}</code> is not a section of this app.
        </p>
        <Button variant="primary" onClick={() => window.location.assign('#/')}>
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}

export function App() {
  const { phase, error } = useStore()
  const route = useRoute()

  if (phase === 'loading') return <Boot />
  if (phase === 'error') return <BootError message={error ?? 'Unknown error.'} />

  const Page = ROUTES[route.path]

  return (
    <Shell>
      <Suspense fallback={<PageSkeleton />}>{Page ? <Page /> : <NotFound path={route.path} />}</Suspense>
    </Shell>
  )
}
