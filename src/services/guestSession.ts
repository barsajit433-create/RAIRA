import type { NavPageId } from '../components/Sidebar';

export const GUEST_SESSION_STORAGE_KEY = 'raira_guest_session_v1';

/**
 * Extensible session architecture prepared for future optional account sync.
 * RAIRA operates strictly in guest-first local mode without mandatory authentication.
 */
export type SessionMode = 'guest';
export type StorageScope = 'local';

export interface GuestSessionState {
  schemaVersion: 1;
  mode: SessionMode;
  storageScope: StorageScope;
  guestId: string;
  hasEnteredApp: boolean;
  tourCompleted: boolean;
  tourSkipped: boolean;
  visitCount: number;
  firstVisitedAt: string;
  lastVisitedAt: string;
  /** Reserved extension point for optional future account synchronisation. */
  syncProvider: null;
}

export interface OnboardingStep {
  stepNumber: number;
  id: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  targetPage: NavPageId;
  workspaceLabel: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    stepNumber: 1,
    id: 'welcome',
    title: 'Welcome to RAIRA',
    subtitle: 'Reinforcement Learning-based Adaptive Intelligent Resource Allocator',
    description:
      'RAIRA is an interactive operating-system research platform for exploring how Reinforcement Learning adapts CPU scheduling and dynamic RAM allocation under changing process workloads.',
    highlights: [
      'Full guest access — every simulator, model, and research lab works immediately with no sign-in.',
      'Your experiment runs, comparisons, and visual theme preferences are saved locally in this browser.',
      'Pretrained Q-Learning (50 episodes) and TensorFlow.js DQN (25 episodes) models are ready to inspect right away.',
    ],
    targetPage: 'overview',
    workspaceLabel: 'Overview Dashboard',
  },
  {
    stepNumber: 2,
    id: 'simulation',
    title: 'Understanding the simulation',
    subtitle: 'Discrete-time OS kernel with constrained CPU and dynamic RAM',
    description:
      'Every experiment runs inside a deterministic single-core operating system simulator with strict memory admission control, dynamic allocation, and automatic memory release upon process completion.',
    highlights: [
      'Hardware envelope: 1-core CPU (100% capacity), 4096 MB dynamic RAM, up to 32 concurrent processes.',
      'Step tick-by-tick or run continuously while watching synchronized CPU Gantt and RAM usage timelines.',
      'Create custom processes manually or generate reproducible workloads across 4 workload categories.',
    ],
    targetPage: 'simulation',
    workspaceLabel: 'Live Simulation',
  },
  {
    stepNumber: 3,
    id: 'algorithms',
    title: 'Exploring scheduling algorithms',
    subtitle: 'Compare classical OS schedulers against adaptive RL agents',
    description:
      'Switch policies on the fly or benchmark all five scheduling approaches across identical deterministic seeds so every comparison is controlled and statistically fair.',
    highlights: [
      'Classical baselines: First-Come First-Served (FCFS), Round Robin (RR), and Priority Scheduling.',
      'Adaptive RL policies: Tabular Q-Learning and Deep Q-Network (DQN) choosing both process and CPU quantum (1, 2, or 4 ticks).',
      'Measure waiting time, turnaround time, response time, CPU/RAM utilisation, throughput, and Jain fairness.',
    ],
    targetPage: 'comparison',
    workspaceLabel: 'Algorithm Comparison',
  },
  {
    stepNumber: 4,
    id: 'rl-training',
    title: 'Understanding the RL Training Centre',
    subtitle: 'Live SMDP training for Q-Learning and TensorFlow.js DQN',
    description:
      'Inspect pretrained checkpoints or train fresh Reinforcement Learning agents directly inside the platform with configurable learning rate, discount factor, exploration decay, and training seeds.',
    highlights: [
      'Separate training and evaluation seeds prevent data leakage and preserve academic integrity.',
      'Semi-Markov Decision Process (SMDP) discounting accounts accurately for variable CPU quantum lengths.',
      'Save, export, or reset checkpoints anytime while monitoring real episode reward and waiting-time convergence.',
    ],
    targetPage: 'training',
    workspaceLabel: 'RL Training Centre',
  },
  {
    stepNumber: 5,
    id: 'research-labs',
    title: 'Discovering research laboratories',
    subtitle: 'Explainability, counterfactuals, shock resilience, fairness, and statistics',
    description:
      'Go beyond black-box scores with six dedicated research laboratories built directly on actual simulator state and real model Q-value outputs.',
    highlights: [
      'XAI & What-If Lab: Inspect exact Q-values, reward breakdowns, and isolated counterfactual alternative actions.',
      'Workload Shock Arena & Fairness Monitor: Test mid-episode process bursts, memory surges, and starvation protection.',
      'Research Analytics: Run 30-seed 95% confidence interval validation, ablation studies, and CSV/JSON exports.',
    ],
    targetPage: 'intelligence',
    workspaceLabel: 'XAI & What-If Lab',
  },
  {
    stepNumber: 6,
    id: 'first-simulation',
    title: 'Starting the first simulation',
    subtitle: 'Run a live workload or jump straight into any workspace',
    description:
      'You are ready to experiment. Load a deterministic 10-process mixed workload right now to see CPU scheduling and memory management in action, or explore the dashboard at your own pace.',
    highlights: [
      'Click "Load Demo & Start" below to populate the simulator immediately and open Live Simulation.',
      'Switch between 4 visual themes anytime from Appearance & Design Studio.',
      'You can reopen the Welcome Screen or restart this 6-step Guided Tour anytime from the sidebar or Design Studio.',
    ],
    targetPage: 'overview',
    workspaceLabel: 'Overview Dashboard',
  },
];

export function generateGuestId(): string {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `guest-${timePart}-${randPart}`;
}

export function createDefaultGuestSession(
  nowIso: string = new Date().toISOString(),
  guestId: string = generateGuestId()
): GuestSessionState {
  return {
    schemaVersion: 1,
    mode: 'guest',
    storageScope: 'local',
    guestId,
    hasEnteredApp: false,
    tourCompleted: false,
    tourSkipped: false,
    visitCount: 1,
    firstVisitedAt: nowIso,
    lastVisitedAt: nowIso,
    syncProvider: null,
  };
}

export function parseGuestSession(
  raw: string | null | undefined,
  nowIso: string = new Date().toISOString()
): { session: GuestSessionState; isFirstVisit: boolean } {
  if (!raw) {
    return {
      session: createDefaultGuestSession(nowIso),
      isFirstVisit: true,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GuestSessionState> | null;
    if (!parsed || typeof parsed !== 'object') {
      return {
        session: createDefaultGuestSession(nowIso),
        isFirstVisit: true,
      };
    }

    const guestId =
      typeof parsed.guestId === 'string' && parsed.guestId.trim().length > 0
        ? parsed.guestId
        : generateGuestId();
    const hasEnteredApp = Boolean(parsed.hasEnteredApp);
    const tourCompleted = Boolean(parsed.tourCompleted);
    const tourSkipped = Boolean(parsed.tourSkipped);
    const visitCount =
      typeof parsed.visitCount === 'number' && Number.isFinite(parsed.visitCount) && parsed.visitCount >= 1
        ? Math.floor(parsed.visitCount)
        : 1;
    const firstVisitedAt =
      typeof parsed.firstVisitedAt === 'string' && parsed.firstVisitedAt.length > 0
        ? parsed.firstVisitedAt
        : nowIso;
    const lastVisitedAt =
      typeof parsed.lastVisitedAt === 'string' && parsed.lastVisitedAt.length > 0
        ? parsed.lastVisitedAt
        : nowIso;

    return {
      session: {
        schemaVersion: 1,
        mode: 'guest',
        storageScope: 'local',
        guestId,
        hasEnteredApp,
        tourCompleted,
        tourSkipped,
        visitCount,
        firstVisitedAt,
        lastVisitedAt,
        syncProvider: null,
      },
      isFirstVisit: !hasEnteredApp,
    };
  } catch {
    return {
      session: createDefaultGuestSession(nowIso),
      isFirstVisit: true,
    };
  }
}

export function serializeGuestSession(session: GuestSessionState): string {
  return JSON.stringify(session);
}

export function markEnteredAsGuest(
  session: GuestSessionState,
  nowIso: string = new Date().toISOString()
): GuestSessionState {
  return {
    ...session,
    mode: 'guest',
    storageScope: 'local',
    hasEnteredApp: true,
    visitCount: session.hasEnteredApp ? session.visitCount + 1 : Math.max(1, session.visitCount),
    lastVisitedAt: nowIso,
  };
}

export function markTourCompleted(
  session: GuestSessionState,
  nowIso: string = new Date().toISOString()
): GuestSessionState {
  return {
    ...session,
    hasEnteredApp: true,
    tourCompleted: true,
    tourSkipped: false,
    lastVisitedAt: nowIso,
  };
}

export function markTourSkipped(
  session: GuestSessionState,
  nowIso: string = new Date().toISOString()
): GuestSessionState {
  return {
    ...session,
    hasEnteredApp: true,
    tourSkipped: true,
    lastVisitedAt: nowIso,
  };
}

export function shouldShowWelcomeOnLoad(
  session: GuestSessionState,
  searchQuery: string = ''
): boolean {
  const params = new URLSearchParams(searchQuery);
  if (params.get('welcome') === '1') {
    return true;
  }
  if (params.get('autostart') === '1') {
    return false;
  }
  return !session.hasEnteredApp;
}

export const guestSessionStorage = {
  load(): GuestSessionState {
    if (typeof window === 'undefined') {
      return createDefaultGuestSession();
    }
    try {
      const raw = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
      const { session } = parseGuestSession(raw);
      return session;
    } catch {
      return createDefaultGuestSession();
    }
  },

  save(session: GuestSessionState): GuestSessionState {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          GUEST_SESSION_STORAGE_KEY,
          serializeGuestSession(session)
        );
      } catch {
        // Ignore storage quota / privacy mode failures
      }
    }
    return session;
  },
};
