/* ============================================================================
   Domain model
   ----------------------------------------------------------------------------
   One file, so the whole shape of the system is readable in a single pass.
   Every persisted collection maps 1:1 to a file in /data.
   ========================================================================= */

/** ISO-8601 date, `YYYY-MM-DD`. Stored date-only to stay timezone-stable. */
export type ISODate = string
/** ISO-8601 timestamp with timezone. */
export type ISODateTime = string
export type ID = string

/* ---------------------------------------------------------------- shared -- */

export type Status = 'not-started' | 'in-progress' | 'blocked' | 'done' | 'dropped'
export type Difficulty = 1 | 2 | 3 | 4 | 5
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type Confidence = 1 | 2 | 3 | 4 | 5

/** The audit's four remediation tiers. Drives colour and sort order app-wide. */
export type GapTier = 'must-fix' | 'should-improve' | 'nice-to-have' | 'advantage'

export interface Note {
  id: ID
  body: string
  createdAt: ISODateTime
}

export interface Link {
  label: string
  url: string
}

/* ------------------------------------------------------------- profile --- */

export interface Profile {
  name: string
  currentRole: string
  currentCompany: string
  location: string
  positioning: string
  headline: string
  /** Day the 24-month programme starts. All month/quarter maths derives from it. */
  startDate: ISODate
  /** Programme length in months. */
  horizonMonths: number
  careerLevelLabel: string
  targetLevelLabel: string
  /** Benchmarks quoted verbatim from the audit. */
  benchmark: {
    localPercentile: string
    internationalPercentile: string
    notYetCompetitiveFor: string[]
    alreadyCompetitiveFor: string[]
  }
  /** The audit's 65–75% confidence band. */
  successProbability: { low: number; high: number; assumptions: string[] }
  /** Hours the user intends to invest each week; drives capacity planning. */
  weeklyHourTarget: number
  bottleneck: string
  highestValueSkill: string
}

/* -------------------------------------------------------------- skills --- */

export type SkillBenchmark =
  | 'Exceptional'
  | 'Excellent'
  | 'Strong'
  | 'Good'
  | 'Below target'
  | 'Weak'

export interface Skill {
  id: ID
  name: string
  /** Short description of what the competency actually means. Feeds tooltips. */
  what: string
  /** Why a Tier-1 hiring loop cares. Feeds contextual help. */
  whyItMatters: string
  category: 'craft' | 'analytical' | 'strategic' | 'human' | 'technical'
  /** Audit baseline, 0–10. Never mutated — it is the historical starting point. */
  baselineScore: number
  /** Current self/evidence-assessed score, 0–10. */
  currentScore: number
  /** Score required to be credible at Tier-1, 0–10. */
  targetScore: number
  benchmark: SkillBenchmark
  /** Weight in the readiness score. Weights across all skills sum to 1. */
  weight: number
  tier: GapTier
  confidence: Confidence
  strengths: string[]
  weaknesses: string[]
  /** Concrete artefacts that prove the score. Evidence, not opinion. */
  evidence: Evidence[]
  improvementPlan: string[]
  /** Cross-references into other collections. */
  relatedBookIds: ID[]
  relatedCourseIds: ID[]
  relatedProjectIds: ID[]
  relatedQuestionIds: ID[]
  /** Score snapshots over time, for the trend line. */
  history: { date: ISODate; score: number }[]
}

export interface Evidence {
  id: ID
  label: string
  kind: 'project' | 'artifact' | 'metric' | 'role' | 'course' | 'other'
  url?: string
  addedAt: ISODate
}

/* ---------------------------------------------------- learning path ------ */

export interface Subtask {
  id: ID
  title: string
  done: boolean
}

export interface PathTask {
  id: ID
  title: string
  description?: string
  status: Status
  estimatedHours: number
  actualHours: number
  difficulty: Difficulty
  xp: number
  subtasks: Subtask[]
  skillIds: ID[]
  resources: Link[]
  /** Task IDs that must be `done` before this one unlocks. */
  dependencies: ID[]
  dueDate?: ISODate
  completedAt?: ISODate
  notes: string
  order: number
}

export interface Mission {
  id: ID
  title: string
  summary: string
  /** Why this mission exists — surfaced as contextual help. */
  rationale: string
  status: Status
  tasks: PathTask[]
  xpBonus: number
  /** Achievement unlocked when every task completes. */
  achievementId?: ID
  reflectionPrompt: string
  reflection: string
  order: number
}

/** A month of the 24-month roadmap. */
export interface Chapter {
  id: ID
  /** 1-based month index within the programme. */
  month: number
  /** Chapters can span months (e.g. 13–18). */
  monthSpan?: [number, number]
  title: string
  focus: string
  /** The audit's "Measurable Output" column. */
  measurableOutput: string
  quarter: number
  missions: Mission[]
  estimatedHours: number
  difficulty: Difficulty
  /** Chapter IDs that gate this one. */
  dependencies: ID[]
  skillIds: ID[]
  bookIds: ID[]
  courseIds: ID[]
  projectIds: ID[]
  targetOutcomes: string[]
  expectedRoi: 'very-high' | 'high' | 'medium' | 'low'
  /** Writing / networking / interview / application targets for the month. */
  commitments: {
    writing: string
    networking: string
    interviewPractice: string
    portfolio: string
    applications: string
  }
  /** Calendar window, derived from the programme start date at seed time. */
  startDate: ISODate
  endDate: ISODate
}

/* -------------------------------------------------------------- tasks ---- */

/** A free-standing task on the Today board, independent of the learning path. */
export interface Task {
  id: ID
  title: string
  status: Status
  priority: Priority
  /** Which area of the system it belongs to. */
  area: TaskArea
  estimatedHours: number
  dueDate?: ISODate
  scheduledFor?: ISODate
  skillIds: ID[]
  xp: number
  createdAt: ISODateTime
  completedAt?: ISODateTime
  /** Link back to a learning-path task if it was pulled from the tree. */
  sourceTaskId?: ID
  order: number
  recurring?: 'daily' | 'weekly' | 'monthly'
}

export type TaskArea =
  | 'sql'
  | 'analytics'
  | 'experimentation'
  | 'portfolio'
  | 'writing'
  | 'networking'
  | 'interview'
  | 'reading'
  | 'course'
  | 'ai'
  | 'applications'
  | 'linkedin'
  | 'admin'

/* -------------------------------------------------------------- goals ---- */

export interface Goal {
  id: ID
  title: string
  description: string
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  /** Numeric target for the period, e.g. 5 SQL problems. */
  target: number
  unit: string
  /** Progress logged for the current period. */
  current: number
  area: TaskArea
  /** Historical periods: key is the period label, value is what was achieved. */
  history: Record<string, number>
  active: boolean
  order: number
  /** Cross-reference to the KPI section of the audit this came from. */
  source: 'weekly-kpi' | 'monthly-kpi' | 'quarterly-kpi' | 'throughput' | 'custom'
}

/* ---------------------------------------------------------- portfolio --- */

export type PortfolioKind =
  | 'case-study'
  | 'redesign'
  | 'ai-project'
  | 'strategy-doc'
  | 'teardown'
  | 'data-project'
  | 'open-source'

export interface PortfolioProject {
  id: ID
  title: string
  kind: PortfolioKind
  /** Audit ROI rank (1 = highest-ROI project in Part 5). */
  roiRank: number
  status: Status
  completion: number
  publishStatus: 'private' | 'draft' | 'review' | 'published'
  url?: string
  /** The narrative spine every strong case study needs. */
  problem: string
  goal: string
  process: string
  research: string
  discovery: string
  ux: string
  metrics: string
  tradeoffs: string
  risks: string
  businessImpact: string
  lessons: string
  skillIds: ID[]
  estimatedHours: number
  actualHours: number
  targetDate?: ISODate
  startedAt?: ISODate
  completedAt?: ISODate
  attachments: Link[]
  screenshots: { id: ID; label: string; url: string }[]
  xp: number
  order: number
}

/* ------------------------------------------------------------- reading --- */

export type ReadingKind = 'book' | 'article' | 'paper' | 'blog-post'

export interface ReadingItem {
  id: ID
  title: string
  author: string
  kind: ReadingKind
  status: 'wishlist' | 'reading' | 'finished' | 'abandoned' | 'reference'
  /** 0–100. For books also derivable from pages. */
  progress: number
  pagesTotal?: number
  pagesRead?: number
  rating?: 1 | 2 | 3 | 4 | 5
  estimatedHours: number
  actualHours: number
  keyTakeaways: string[]
  highlights: { id: ID; text: string; page?: string }[]
  notes: string
  skillIds: ID[]
  startedAt?: ISODate
  completedAt?: ISODate
  url?: string
  /** Flagged in the audit's interview-prep resource list. */
  isCoreInterviewResource: boolean
  priority: Priority
  xp: number
  order: number
}

/* ------------------------------------------------------------- courses --- */

export interface Course {
  id: ID
  title: string
  provider: string
  url?: string
  status: Status
  hours: number
  hoursCompleted: number
  progress: number
  difficulty: Difficulty
  importance: Priority
  /** Career payoff per hour invested, 1–10. Ranked on the Leverage page. */
  roi: number
  hasCertificate: boolean
  certificateUrl?: string
  projects: string[]
  notes: string
  skillIds: ID[]
  startedAt?: ISODate
  completedAt?: ISODate
  xp: number
  order: number
}

/* --------------------------------------------------------- interviews --- */

export type InterviewTrack =
  | 'product-sense'
  | 'execution'
  | 'strategy'
  | 'metrics'
  | 'analytics'
  | 'estimation'
  | 'leadership'
  | 'behavioral'
  | 'system-design'

export interface InterviewQuestion {
  id: ID
  prompt: string
  track: InterviewTrack
  difficulty: Difficulty
  company?: string
  practiceCount: number
  lastAttempt?: ISODate
  confidence: Confidence
  /** Self-scored answer quality out of 10, most recent attempt. */
  score?: number
  scoreHistory: { date: ISODate; score: number }[]
  notes: string
  feedback: string
  idealAnswer: string
  framework?: string
  videoPracticeUrl?: string
  skillIds: ID[]
  starred: boolean
}

export interface MockInterview {
  id: ID
  date: ISODate
  track: InterviewTrack
  partner: string
  durationMinutes: number
  score: number
  strengths: string
  improvements: string
  questionIds: ID[]
  notes: string
}

/* --------------------------------------------------------- networking --- */

export type ContactKind = 'pm-leader' | 'recruiter' | 'peer' | 'hiring-manager' | 'mentor' | 'other'
export type RelationshipStrength = 1 | 2 | 3 | 4 | 5

export interface Contact {
  id: ID
  name: string
  company: string
  role: string
  kind: ContactKind
  status: 'to-reach-out' | 'reached-out' | 'in-conversation' | 'warm' | 'referral-given' | 'dormant'
  relationshipStrength: RelationshipStrength
  linkedinUrl?: string
  email?: string
  nextAction: string
  nextActionDate?: ISODate
  lastContact?: ISODate
  /** Chronological log of every touchpoint. */
  touchpoints: { id: ID; date: ISODate; kind: 'message' | 'call' | 'coffee-chat' | 'event' | 'comment' | 'referral'; note: string }[]
  couldRefer: boolean
  targetCompanyTier?: 1 | 2 | 3
  notes: string
}

export interface NetworkingEvent {
  id: ID
  name: string
  kind: 'conference' | 'meetup' | 'webinar' | 'ama' | 'workshop'
  date: ISODate
  location: string
  status: 'considering' | 'registered' | 'attended' | 'skipped'
  url?: string
  goal: string
  outcomes: string
  contactsMade: number
  cost?: string
}

/* ----------------------------------------------------------- linkedin --- */

export interface LinkedInSnapshot {
  date: ISODate
  followers: number
  connections: number
  impressions: number
  profileViews: number
  searchAppearances: number
  posts: number
  comments: number
}

export interface ContentIdea {
  id: ID
  title: string
  angle: string
  /** One of the audit's five "About themes". */
  theme: string
  format: 'deep-dive' | 'short-post' | 'carousel' | 'article' | 'teardown'
  status: 'idea' | 'drafting' | 'scheduled' | 'published'
  scheduledFor?: ISODate
  publishedAt?: ISODate
  url?: string
  impressions?: number
  reactions?: number
  comments?: number
  skillIds: ID[]
  order: number
}

export interface LinkedInData {
  positioning: string
  headline: string
  aboutThemes: string[]
  weeklyCadence: { label: string; target: number; unit: string }[]
  snapshots: LinkedInSnapshot[]
  ideas: ContentIdea[]
  monthlyGoals: { month: string; followers: number; posts: number; comments: number; connections: number }[]
}

/* ------------------------------------------------------------ writing --- */

export interface WritingPiece {
  id: ID
  title: string
  kind: 'article' | 'case-study' | 'newsletter' | 'teardown' | 'essay'
  status: 'idea' | 'outlining' | 'drafting' | 'editing' | 'published'
  /** Word count so far, and the target. */
  words: number
  targetWords: number
  topics: string[]
  skillIds: ID[]
  outline: string
  draft: string
  publication?: string
  url?: string
  scheduledFor?: ISODate
  publishedAt?: ISODate
  views?: number
  xp: number
  order: number
}

/* ------------------------------------------------------- applications --- */

export type ApplicationStage =
  | 'researching'
  | 'applied'
  | 'recruiter-screen'
  | 'hiring-manager'
  | 'take-home'
  | 'onsite-loop'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted'

export interface JobApplication {
  id: ID
  company: string
  role: string
  companyTier: 1 | 2 | 3
  country: string
  remote: 'onsite' | 'hybrid' | 'remote'
  salaryRange?: string
  jobUrl?: string
  appliedDate?: ISODate
  stage: ApplicationStage
  hasReferral: boolean
  referrerContactId?: ID
  recruiterName?: string
  recruiterContactId?: ID
  /** One entry per round. */
  rounds: { id: ID; date: ISODate; kind: string; interviewer: string; notes: string; outcome: 'pending' | 'pass' | 'fail' }[]
  interviewNotes: string
  outcome?: 'offer' | 'rejected' | 'withdrawn' | 'pending'
  lessonsLearned: string
  order: number
}

export interface TargetCompany {
  id: ID
  name: string
  tier: 1 | 2 | 3
  note: string
  /** Personal fit assessment, 0–100. */
  fit: number
  watching: boolean
}

/* ------------------------------------------------------- achievements --- */

export interface Achievement {
  id: ID
  name: string
  description: string
  icon: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  xp: number
  /** How the app decides it is earned. Evaluated by the rules engine. */
  criterion: AchievementCriterion
  unlockedAt?: ISODateTime
  /** Hidden until unlocked, for a bit of discovery. */
  secret?: boolean
  category: 'learning' | 'portfolio' | 'analytics' | 'interview' | 'brand' | 'consistency' | 'milestone'
}

/** Declarative achievement rules — evaluated against derived stats. */
export type AchievementCriterion =
  | { type: 'total-hours'; value: number }
  | { type: 'total-xp'; value: number }
  | { type: 'level'; value: number }
  | { type: 'streak-days'; value: number }
  | { type: 'skill-score'; skillId: ID; value: number }
  | { type: 'readiness'; value: number }
  | { type: 'count'; collection: CountableCollection; value: number; filter?: string }
  | { type: 'chapter-complete'; month: number }
  | { type: 'all-chapters-in-quarter'; quarter: number }
  | { type: 'manual' }

export type CountableCollection =
  | 'published-case-studies'
  | 'published-portfolio'
  | 'published-writing'
  | 'finished-books'
  | 'completed-courses'
  | 'mock-interviews'
  | 'questions-practiced'
  | 'contacts'
  | 'referrals'
  | 'applications'
  | 'teardowns'
  | 'ai-projects'
  | 'completed-tasks'
  | 'journal-entries'

export interface Badge {
  id: ID
  name: string
  description: string
  icon: string
  /** Progressive badge: how many levels and where the user is. */
  levels: { label: string; threshold: number }[]
  criterion: AchievementCriterion
  category: Achievement['category']
}

/* ---------------------------------------------------------- analytics --- */

/** One row per day the user logged work. The single source for streaks, heat maps and velocity. */
export interface ActivityLog {
  date: ISODate
  hours: number
  xp: number
  tasksCompleted: number
  /** Hours attributed per skill id. */
  bySkill: Record<ID, number>
  byArea: Partial<Record<TaskArea, number>>
  note?: string
}

export interface ReadinessSnapshot {
  date: ISODate
  score: number
  /** Per-skill scores at that moment, for the trend + spider comparison. */
  skills: Record<ID, number>
}

export interface AnalyticsData {
  activity: ActivityLog[]
  readinessHistory: ReadinessSnapshot[]
  /** Hours the user has committed to per week, over time. */
  capacityHistory: { weekStart: ISODate; plannedHours: number; actualHours: number }[]
}

/* ------------------------------------------------------------ journal --- */

export interface JournalEntry {
  id: ID
  date: ISODate
  kind: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  mood?: 1 | 2 | 3 | 4 | 5
  energy?: 1 | 2 | 3 | 4 | 5
  /** Keyed by prompt id so the template can evolve without losing entries. */
  answers: Record<string, string>
  hoursLogged?: number
  wins: string[]
  blockers: string[]
  tags: string[]
  createdAt: ISODateTime
}

export interface JournalData {
  entries: JournalEntry[]
  prompts: { id: string; question: string; kind: JournalEntry['kind']; helper?: string }[]
}

/* ----------------------------------------------------------- leverage --- */

/** A row on the Highest Leverage (80/20) page. */
export interface LeverageAction {
  id: ID
  action: string
  /** Career impact 1–10, straight from the audit table where available. */
  impact: number
  /** Total hours, or null for ongoing work. */
  hours: number | null
  isOngoing: boolean
  difficulty: number
  timeToResults: string
  /** Sortable months-until-visible-results, derived from timeToResults. */
  timeToResultsMonths: number
  longTermRoi: 'Very High' | 'High' | 'Medium' | 'Low'
  category: TaskArea
  /** True for the audit's explicit "ignore this" list. */
  isAntiPattern?: boolean
  rationale: string
  linkedGoalIds: ID[]
}

export interface LeverageData {
  actions: LeverageAction[]
  antiPatterns: { id: ID; action: string; why: string }[]
  /** The audit's "if you have N hours/week" allocations. */
  timeBudgets: {
    hoursPerWeek: number
    allocations: { label: string; hours: number | null; area: TaskArea }[]
  }[]
  oneYearSequence: { step: number; label: string; detail: string }[]
  mistakes: { title: string; detail: string }[]
  startDoing: string[]
  stopDoing: string[]
  ifIWereResponsible: string[]
}

/* ------------------------------------------------------------ roadmap --- */

export interface RoadmapData {
  chapters: Chapter[]
  /** Ongoing throughput commitments that run across all 24 months. */
  throughput: { id: ID; label: string; detail: string; cadence: string }[]
  phases: { id: ID; label: string; months: [number, number]; theme: string; colorToken: string }[]
}

/* ---------------------------------------------------- compensation ------ */

export interface CompensationRow {
  region: string
  todayLow: number
  todayHigh: number
  targetLow: number
  targetHigh: number
}

/* ----------------------------------------------------------- settings --- */

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  accent: 'indigo' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'blue'
  sidebarCollapsed: boolean
  density: 'comfortable' | 'compact'
  /** Persist to the /data folder automatically, or require an explicit save. */
  autoSave: boolean
  showCelebrations: boolean
  reduceMotion: boolean
  weekStartsOn: 0 | 1
  /** Sections hidden from the sidebar. */
  hiddenSections: string[]
  /** Dashboard widget ids in display order; unknown ids are ignored. */
  dashboardLayout: string[]
  lastBackupAt?: ISODateTime
}

/* ------------------------------------------------------- root document -- */

/** The complete application state. Each key persists to `data/<key>.json`. */
export interface AppData {
  profile: Profile
  skills: Skill[]
  roadmap: RoadmapData
  tasks: Task[]
  goals: Goal[]
  portfolio: PortfolioProject[]
  books: ReadingItem[]
  courses: Course[]
  interviews: {
    questions: InterviewQuestion[]
    mocks: MockInterview[]
  }
  networking: {
    contacts: Contact[]
    events: NetworkingEvent[]
  }
  linkedin: LinkedInData
  writing: WritingPiece[]
  applications: {
    applications: JobApplication[]
    targetCompanies: TargetCompany[]
    compensation: CompensationRow[]
  }
  achievements: {
    achievements: Achievement[]
    badges: Badge[]
  }
  analytics: AnalyticsData
  journal: JournalData
  leverage: LeverageData
  settings: Settings
}

/** File-name ↔ state-key mapping. Order matters for load progress display. */
export const DATA_FILES = [
  'profile',
  'skills',
  'roadmap',
  'tasks',
  'goals',
  'portfolio',
  'books',
  'courses',
  'interviews',
  'networking',
  'linkedin',
  'writing',
  'applications',
  'achievements',
  'analytics',
  'journal',
  'leverage',
  'settings',
] as const

export type DataFileKey = (typeof DATA_FILES)[number]
