import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlgorithmType, SimulationSnapshot } from './types/simulation';
import type { ExperimentRecord, SeedComparisonBatch } from './types/experiment';
import type {
  TrainingEpisodeMetric,
  TrainingSessionSnapshot,
} from './types/reinforcementLearning';
import type { StatisticalValidationReport } from './types/intelligence';
import { rairaApi } from './services/api';
import { experimentStorage } from './services/experimentStorage';
import { Sidebar, type NavPageId } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { ProcessManager } from './pages/ProcessManager';
import { LiveSimulation } from './pages/LiveSimulation';
import { TrainingCentre } from './pages/TrainingCentre';
import { IntelligenceLab } from './pages/IntelligenceLab';
import { ShockArena } from './pages/ShockArena';
import { FairnessMonitorPage } from './pages/FairnessMonitorPage';
import { AlgorithmComparison } from './pages/AlgorithmComparison';
import { ResearchAnalytics } from './pages/ResearchAnalytics';
import { ExperimentHistory } from './pages/ExperimentHistory';
import { ProjectInformation } from './pages/ProjectInformation';
import { DesignStudio } from './pages/DesignStudio';
import { useTheme } from './theme/ThemeContext';

export default function App() {
  const { settings, updateSettings } = useTheme();
  const [activePage, setActivePage] = useState<NavPageId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarCollapsed = settings.sidebarCollapsed;
  const toggleSidebarCollapsed = () =>
    updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed });

  const [simulation, setSimulation] = useState<SimulationSnapshot | null>(null);
  const [training, setTraining] = useState<TrainingSessionSnapshot | null>(null);
  const [qHistory, setQHistory] = useState<TrainingEpisodeMetric[]>([]);
  const [dqnHistory, setDqnHistory] = useState<TrainingEpisodeMetric[]>([]);
  const [latestComparison, setLatestComparison] = useState<SeedComparisonBatch | null>(() => {
    const saved = experimentStorage.loadComparisons();
    return saved.length > 0 ? saved[0] : null;
  });
  const [latestValidationReport, setLatestValidationReport] =
    useState<StatisticalValidationReport | null>(() => {
      const saved = experimentStorage.loadValidationReports();
      return saved.length > 0 ? saved[0] : null;
    });
  const [experiments, setExperiments] = useState<ExperimentRecord[]>(() =>
    experimentStorage.loadHistory()
  );

  const [stepIntervalMs, setStepIntervalMs] = useState<number>(
    () => experimentStorage.loadSettings().stepIntervalMs
  );
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const lastAutoLoggedSimKey = useRef<string | null>(null);
  const lastAutoLoggedTrainKey = useRef<string | null>(null);
  const userMutatedSimRef = useRef(false);

  const syncTrainingHistories = useCallback((snap: TrainingSessionSnapshot) => {
    setTraining(snap);
    if (Array.isArray(snap.qLearningHistory)) {
      setQHistory(snap.qLearningHistory);
    } else if (snap.config?.agentType === 'Q_LEARNING' && snap.history.length > 0) {
      setQHistory(snap.history);
    }
    if (Array.isArray(snap.dqnHistory)) {
      setDqnHistory(snap.dqnHistory);
    } else if (snap.config?.agentType === 'DQN' && snap.history.length > 0) {
      setDqnHistory(snap.history);
    }
  }, []);

  const recordSimulationToHistory = useCallback((snap: SimulationSnapshot, note?: string) => {
    if (snap.processes.length === 0 || snap.currentTick === 0) return;
    const isTrained =
      snap.algorithm === 'Q_LEARNING'
        ? snap.rlTrainedStatus.qLearningTrained
        : snap.algorithm === 'DQN'
          ? snap.rlTrainedStatus.dqnTrained
          : true;

    const record: ExperimentRecord = {
      id: `EXP-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      algorithm: snap.algorithm,
      isTrainedModel: isTrained,
      provenance: isTrained ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED',
      workloadType: snap.workloadType,
      numProcesses: snap.processes.length,
      seed: snap.seed,
      episodes: 1,
      avgWaitingTime: snap.metrics.avgWaitingTime,
      avgTurnaroundTime: snap.metrics.avgTurnaroundTime,
      avgResponseTime: snap.metrics.avgResponseTime,
      cpuUtilisation: snap.metrics.avgCpuUtilisation,
      ramUtilisation: snap.metrics.avgRamUtilisation,
      throughput: snap.metrics.throughput,
      jainFairness: snap.metrics.jainFairnessIndex,
      reward: snap.metrics.totalEpisodeReward,
      rewardPreset: snap.fairnessMonitor?.activeRewardPreset ?? 'BALANCED',
      rewardWeights: { ...snap.rewardWeights },
      notes: note ?? `Live simulation run (${snap.status} at tick ${snap.currentTick})`,
    };
    setExperiments(experimentStorage.addHistoryRecord(record));
  }, []);

  const recordTrainingToHistory = useCallback((snap: TrainingSessionSnapshot) => {
    if (!snap.config || snap.history.length === 0) return;
    const last = snap.history[snap.history.length - 1];
    const record: ExperimentRecord = {
      id: `TRN-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      algorithm: snap.config.agentType,
      isTrainedModel: true,
      provenance: 'ACTUAL_GENERATED',
      workloadType: snap.config.workloadType,
      numProcesses: snap.config.numProcesses,
      seed: snap.config.seed,
      episodes: snap.history.length,
      avgWaitingTime: last.avgWaitingTime,
      avgTurnaroundTime: last.avgTurnaroundTime,
      avgResponseTime: 0,
      cpuUtilisation: last.avgCpuUtil,
      ramUtilisation: last.avgRamUtil,
      throughput:
        last.ticks > 0 ? Number(((last.completedCount / last.ticks) * 100).toFixed(2)) : 0,
      jainFairness: last.jainFairness,
      reward: snap.averageReward ?? last.totalReward,
      notes: `RL training (${snap.history.length} ep, lr=${snap.config.learningRate}, gamma=${snap.config.discountFactor}, best=${snap.bestReward ?? last.totalReward})`,
    };
    setExperiments(experimentStorage.addHistoryRecord(record));
  }, []);

  // Initial load from backend API (simulation state hydrates immediately without waiting on TF.js DQN init)
  useEffect(() => {
    let active = true;

    const hydrateSimulation = async () => {
      try {
        const simSnap = await rairaApi.getSimulationState();
        if (!active) return;
        if (!userMutatedSimRef.current) {
          setSimulation((prev) => (prev && prev.processes.length > 0 ? prev : simSnap));
        }

        // Optional ?autostart=1 support for automated testing
        const params = new URLSearchParams(window.location.search);
        if (
          params.get('autostart') === '1' &&
          simSnap.processes.length === 0 &&
          !userMutatedSimRef.current
        ) {
          const demoSnap = await rairaApi.loadWorkload({
            workloadType: 'MIXED',
            numProcesses: 10,
            seed: 42,
            algorithm: 'FCFS',
          });
          if (active && !userMutatedSimRef.current) {
            setSimulation(demoSnap);
          }
        }
      } catch (err) {
        if (active) {
          setGlobalError(err instanceof Error ? err.message : 'Unable to connect to RAIRA API.');
        }
      }
    };

    const hydrateSecondary = async () => {
      try {
        const [trainSnap, cmpRes] = await Promise.all([
          rairaApi.getTrainingStatus(),
          rairaApi.getLatestComparison(),
        ]);
        if (!active) return;
        syncTrainingHistories(trainSnap);
        if (cmpRes.comparison) {
          setLatestComparison(cmpRes.comparison);
        }
      } catch (err) {
        if (active) {
          setGlobalError(err instanceof Error ? err.message : 'Unable to initialize RL status.');
        }
      }
    };

    void hydrateSimulation().then(() => {
      if (active) void hydrateSecondary();
    });

    return () => {
      active = false;
    };
  }, [syncTrainingHistories]);

  // Controlled polling for active simulation
  useEffect(() => {
    if (simulation?.status !== 'RUNNING') return;
    const timer = setInterval(async () => {
      try {
        const snap = await rairaApi.getSimulationState();
        setSimulation(snap);
        if (snap.status === 'COMPLETED' || snap.status === 'TRUNCATED') {
          const key = `${snap.algorithm}-${snap.workloadType}-${snap.seed}-${snap.currentTick}-${snap.metrics.totalEpisodeReward}`;
          if (lastAutoLoggedSimKey.current !== key) {
            lastAutoLoggedSimKey.current = key;
            recordSimulationToHistory(snap);
          }
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 240);
    return () => clearInterval(timer);
  }, [simulation?.status, recordSimulationToHistory]);

  // Controlled polling for active RL training
  useEffect(() => {
    if (training?.state !== 'TRAINING') return;
    const timer = setInterval(async () => {
      try {
        const snap = await rairaApi.getTrainingStatus();
        syncTrainingHistories(snap);
        if (snap.state === 'COMPLETED') {
          const key = `${snap.config?.agentType}-${snap.currentEpisode}-${snap.averageReward}`;
          if (lastAutoLoggedTrainKey.current !== key) {
            lastAutoLoggedTrainKey.current = key;
            recordTrainingToHistory(snap);
            // Refresh simulation snapshot so trained RL status badges stay current
            const simSnap = await rairaApi.getSimulationState();
            setSimulation(simSnap);
          }
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 320);
    return () => clearInterval(timer);
  }, [training?.state, syncTrainingHistories, recordTrainingToHistory]);

  // Simulation Handlers
  const handleLaunchDemo = async () => {
    userMutatedSimRef.current = true;
    setBusy(true);
    setGlobalError(null);
    try {
      const snap = await rairaApi.loadWorkload({
        workloadType: 'MIXED',
        numProcesses: 10,
        seed: 42,
        algorithm: simulation?.algorithm ?? 'FCFS',
      });
      setSimulation(snap);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    setGlobalError(null);
    try {
      const snap = await rairaApi.startSimulation(stepIntervalMs);
      setSimulation(snap);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    try {
      setSimulation(await rairaApi.pauseSimulation());
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleResume = async () => {
    try {
      setSimulation(await rairaApi.resumeSimulation());
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReset = async () => {
    try {
      setSimulation(await rairaApi.resetSimulation());
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStep = async () => {
    setBusy(true);
    setGlobalError(null);
    try {
      const snap = await rairaApi.stepSimulation();
      setSimulation(snap);
      if (snap.status === 'COMPLETED' || snap.status === 'TRUNCATED') {
        const key = `${snap.algorithm}-${snap.workloadType}-${snap.seed}-${snap.currentTick}-${snap.metrics.totalEpisodeReward}`;
        if (lastAutoLoggedSimKey.current !== key) {
          lastAutoLoggedSimKey.current = key;
          recordSimulationToHistory(snap);
        }
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleChangeAlgorithm = async (alg: AlgorithmType) => {
    setGlobalError(null);
    try {
      const snap = await rairaApi.configureSimulation({ algorithm: alg });
      setSimulation(snap);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleChangeRRQuantum = async (q: number) => {
    try {
      const snap = await rairaApi.configureSimulation({ rrQuantum: q });
      setSimulation(snap);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleChangeSpeed = async (ms: number) => {
    setStepIntervalMs(ms);
    experimentStorage.saveSettings({ stepIntervalMs: ms });
    try {
      const snap = await rairaApi.configureSimulation({ stepIntervalMs: ms });
      setSimulation(snap);
    } catch {
      // Keep local preference
    }
  };

  const handleComparisonComplete = (batch: SeedComparisonBatch) => {
    setLatestComparison(batch);
    experimentStorage.saveComparison(batch);

    const newRecords: ExperimentRecord[] = batch.aggregated
      .filter((a) => a.available)
      .map((a) => ({
        id: `CMP-${Date.now().toString(36).toUpperCase()}-${a.algorithm.slice(0, 2)}`,
        timestamp: batch.timestamp,
        algorithm: a.algorithm,
        isTrainedModel: a.isTrainedModel,
        provenance: a.provenance,
        workloadType: batch.workloadType,
        numProcesses: batch.numProcesses,
        seed: batch.seeds[0],
        episodes: batch.seeds.length,
        avgWaitingTime: a.avgWaitingTime,
        avgTurnaroundTime: a.avgTurnaroundTime,
        avgResponseTime: a.avgResponseTime,
        cpuUtilisation: a.avgCpuUtilisation,
        ramUtilisation: a.avgRamUtilisation,
        throughput: a.throughput,
        jainFairness: a.jainFairnessIndex,
        reward: a.avgEpisodeReward,
        notes: `Comparison across ${batch.seeds.length} seed(s): [${batch.seeds.join(', ')}]`,
      }));

    if (newRecords.length > 0) {
      setExperiments(experimentStorage.addHistoryRecords(newRecords));
    }
  };

  const handleValidationComplete = (report: StatisticalValidationReport) => {
    setLatestValidationReport(report);
    experimentStorage.saveValidationReport(report);
  };

  return (
    <div className="min-h-screen flex text-[var(--text-primary)]">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activePage={activePage}
          simulation={simulation}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onLaunchDemo={handleLaunchDemo}
          onNavigate={setActivePage}
          demoLoading={busy}
        />

        <main
          className={`flex-1 max-w-[1600px] w-full mx-auto ${
            settings.layoutDensity === 'compact'
              ? 'px-3 sm:px-5 lg:px-6 py-4'
              : 'px-4 sm:px-6 lg:px-8 py-6'
          }`}
        >
          {globalError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border px-4 py-3 text-xs flex items-center justify-between gap-3"
              style={{
                borderColor: 'var(--status-danger)',
                backgroundColor: 'var(--status-danger-soft)',
                color: 'var(--status-danger)',
              }}
            >
              <span>{globalError}</span>
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                className="font-semibold underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {activePage === 'overview' && (
            <Dashboard
              simulation={simulation}
              training={training}
              recentExperiments={experiments}
              busy={busy}
              onLaunchDemo={handleLaunchDemo}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onStep={handleStep}
              onReset={handleReset}
              onChangeAlgorithm={handleChangeAlgorithm}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'processes' && (
            <ProcessManager
              simulation={simulation}
              onSimulationUpdated={setSimulation}
            />
          )}

          {activePage === 'simulation' && (
            <LiveSimulation
              simulation={simulation}
              training={training}
              busy={busy}
              stepIntervalMs={stepIntervalMs}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onStep={handleStep}
              onReset={handleReset}
              onChangeAlgorithm={handleChangeAlgorithm}
              onChangeRRQuantum={handleChangeRRQuantum}
              onChangeSpeed={handleChangeSpeed}
              onSaveRunToHistory={() => {
                if (simulation) recordSimulationToHistory(simulation, 'Manually logged run');
              }}
              onLaunchDemo={handleLaunchDemo}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'intelligence' && (
            <IntelligenceLab
              simulation={simulation}
              busy={busy}
              onLaunchDemo={handleLaunchDemo}
              onStep={handleStep}
              onPause={handlePause}
              onReset={handleReset}
              onChangeAlgorithm={handleChangeAlgorithm}
            />
          )}

          {activePage === 'shock-arena' && <ShockArena />}

          {activePage === 'fairness' && (
            <FairnessMonitorPage
              simulation={simulation}
              onSimulationUpdated={setSimulation}
              onLaunchDemo={handleLaunchDemo}
            />
          )}

          {activePage === 'training' && (
            <TrainingCentre
              training={training}
              onTrainingUpdated={syncTrainingHistories}
              onTrainingCompletedLog={recordTrainingToHistory}
            />
          )}

          {activePage === 'comparison' && (
            <AlgorithmComparison
              latestComparison={latestComparison}
              training={training}
              onComparisonComplete={handleComparisonComplete}
              latestValidationReport={latestValidationReport}
              onValidationComplete={handleValidationComplete}
            />
          )}

          {activePage === 'analytics' && (
            <ResearchAnalytics
              simulation={simulation}
              training={training}
              qHistory={qHistory}
              dqnHistory={dqnHistory}
              latestComparison={latestComparison}
              experiments={experiments}
              latestValidationReport={latestValidationReport}
              onValidationComplete={handleValidationComplete}
            />
          )}

          {activePage === 'history' && (
            <ExperimentHistory
              records={experiments}
              onDeleteRecord={(id) => setExperiments(experimentStorage.deleteHistoryRecord(id))}
              onClearAll={() => setExperiments(experimentStorage.clearHistory())}
            />
          )}

          {activePage === 'project-info' && <ProjectInformation />}

          {activePage === 'design-studio' && (
            <DesignStudio
              simulation={simulation}
              busy={busy}
              onLaunchDemo={handleLaunchDemo}
            />
          )}
        </main>
      </div>
    </div>
  );
}
