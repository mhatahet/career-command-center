/* ============================================================================
   Navigation registry
   ----------------------------------------------------------------------------
   One list, consumed by the sidebar, the command palette and the router. Adding
   a section means adding a row here — nothing else needs to change.
   ========================================================================= */

export interface NavItem {
  id: string
  path: string
  label: string
  icon: string
  group: 'core' | 'learn' | 'build' | 'market' | 'measure' | 'system'
  /** Shown in the command palette and as sidebar tooltip help. */
  description: string
  /** Single-key shortcut when pressed after `g`. */
  shortcut?: string
}

export const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'core', label: '' },
  { id: 'learn', label: 'Learn' },
  { id: 'build', label: 'Build' },
  { id: 'market', label: 'Go to market' },
  { id: 'measure', label: 'Measure' },
  { id: 'system', label: '' },
]

export const NAV: NavItem[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
    icon: '🏠',
    group: 'core',
    description: 'Where am I today, how far have I come, what should I do next',
    shortcut: 'd',
  },
  {
    id: 'learning-path',
    path: '/learning-path',
    label: 'Learning Path',
    icon: '🗺',
    group: 'learn',
    description: 'The 24-month roadmap as a learning tree: chapters, missions, tasks',
    shortcut: 'l',
  },
  {
    id: 'roadmap',
    path: '/roadmap',
    label: 'Career Roadmap',
    icon: '🎯',
    group: 'learn',
    description: 'Month-by-month milestones, dependencies and expected ROI',
    shortcut: 'r',
  },
  {
    id: 'skills',
    path: '/skills',
    label: 'Skills',
    icon: '📚',
    group: 'learn',
    description: 'The sixteen competencies: scores, evidence, gaps, improvement plans',
    shortcut: 's',
  },
  {
    id: 'readiness',
    path: '/readiness',
    label: 'Readiness Score',
    icon: '🧭',
    group: 'learn',
    description: 'The composite score out of 100, its four pillars and the trend',
  },
  {
    id: 'reading',
    path: '/reading',
    label: 'Reading',
    icon: '📖',
    group: 'learn',
    description: 'Books, articles and papers with takeaways and highlights',
  },
  {
    id: 'courses',
    path: '/courses',
    label: 'Courses',
    icon: '🎓',
    group: 'learn',
    description: 'Courses ranked by ROI per hour, with the projects that prove them',
  },
  {
    id: 'portfolio',
    path: '/portfolio',
    label: 'Portfolio',
    icon: '💻',
    group: 'build',
    description: 'All seven highest-ROI artefacts, from problem framing to business impact',
    shortcut: 'p',
  },
  {
    id: 'case-studies',
    path: '/case-studies',
    label: 'Case Studies',
    icon: '📝',
    group: 'build',
    description: 'Case studies and redesigns, with the full narrative spine',
  },
  {
    id: 'ai-projects',
    path: '/ai-projects',
    label: 'AI Projects',
    icon: '🤖',
    group: 'build',
    description: 'AI product work: retrieval, prompts, evaluation, unit economics',
  },
  {
    id: 'writing',
    path: '/writing',
    label: 'Writing',
    icon: '✍️',
    group: 'build',
    description: 'The monthly article cadence, drafts and publishing calendar',
    shortcut: 'w',
  },
  {
    id: 'interview-prep',
    path: '/interview-prep',
    label: 'Interview Prep',
    icon: '🎤',
    group: 'market',
    description: 'Question bank across nine tracks, plus the mock interview log',
    shortcut: 'i',
  },
  {
    id: 'networking',
    path: '/networking',
    label: 'Networking',
    icon: '🤝',
    group: 'market',
    description: 'Contacts, relationship strength, next actions and events',
    shortcut: 'n',
  },
  {
    id: 'linkedin',
    path: '/linkedin',
    label: 'LinkedIn',
    icon: '📣',
    group: 'market',
    description: 'Growth metrics, posting cadence, content calendar and idea backlog',
  },
  {
    id: 'applications',
    path: '/applications',
    label: 'Job Applications',
    icon: '💼',
    group: 'market',
    description: 'Pipeline by stage, target companies by tier, compensation bands',
    shortcut: 'a',
  },
  {
    id: 'analytics',
    path: '/analytics',
    label: 'Analytics',
    icon: '📊',
    group: 'measure',
    description: 'Hours, velocity, consistency, skill growth and projected completion',
  },
  {
    id: 'leverage',
    path: '/leverage',
    label: 'Highest Leverage',
    icon: '⚡',
    group: 'measure',
    description: 'The 80/20 table: rank every activity by ROI, hours and career impact',
    shortcut: 'h',
  },
  {
    id: 'achievements',
    path: '/achievements',
    label: 'Achievements',
    icon: '🏆',
    group: 'measure',
    description: 'Achievements, progressive badges and unlock progress',
  },
  {
    id: 'progress',
    path: '/progress',
    label: 'Progress',
    icon: '📈',
    group: 'measure',
    description: 'Weekly, monthly and quarterly KPIs against the audit\'s targets',
  },
  {
    id: 'journal',
    path: '/journal',
    label: 'Journal',
    icon: '📔',
    group: 'measure',
    description: 'Daily reflections, weekly reviews and monthly retrospectives',
    shortcut: 'j',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: '⚙',
    group: 'system',
    description: 'Theme, density, data folder, backup and restore',
  },
]

export function navFor(path: string): NavItem | undefined {
  return NAV.find((item) => item.path === path)
}
