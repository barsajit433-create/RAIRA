import React, { useRef, useState } from 'react';
import {
  Download,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
  Upload,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkloadType } from '../types/process';
import type {
  RLAgentType,
  RLTrainingConfig,
  TrainingSessionSnapshot,
} from '../types/reinforcementLearning';
import { rairaApi } from '../services/api';
import { experimentStorage } from '../services/experimentStorage';
import { exportService } from '../services/exportService';
import { MetricCard } from '../components/MetricCard';

interface TrainingCentreProps {
  training: TrainingSessionSnapshot | null;
  onTrainingUpdated: (snap: TrainingSessionSnapshot) => void;
  onTrainingCompletedLog: (snap: TrainingSessionSnapshot) => void;
}

export const TrainingCentre: React.FC<TrainingCentreProps> = ({
  training,
  onTrainingUpdated,
  onTrainingCompletedLog,
}) => {
  const [agentType, setAgentType] = useState<RLAgentType>('Q_LEARNING');
  const [workloadType, setWorkloadType] = useState<Exclude<WorkloadType, 'CUSTOM'>>('MIXED');
  const [numProcesses, setNumProcesses] = useState(8);
  const [episodes, setEpisodes] = useState(25);
  const [learningRate, setLearningRate] = useState(0.15);
  const [discountFactor, setDiscountFactor] = useState(0.95);
  const [epsilonStart, setEpsilonStart] = useState(1.0);
  const [epsilonDecay, setEpsilonDecay] = useState(0.95);
  const [epsilonMin, setEpsilonMin] = useState(0.05);
  const [batchSize, setBatchSize] = useState(32);
  const [targetUpdateFreq, setTargetUpdateFreq] = useState(20);
  const [seed, setSeed] = useState(42);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSwitchAgent = (next: RLAgentType) => {
    setAgentType(next);
    setLearningRate(next === 'DQN' ? 0.001 : 0.15);
    setEpisodes(next === 'DQN' ? 12 : 30);
    setFeedback(null);
  };

  const isRunning = training?.state === 'TRAINING';
  const isPaused = training?.state === 'PAUSED';
  const dqnStatus = training?.dqnSummary.dqnStatus;
  const dqnUnavailable = agentType === 'DQN' && dqnStatus && !dqnStatus.available;

  const progressPercent =
    training && training.totalEpisodes > 0
      ? Math.min(100, (training.currentEpisode / training.totalEpisodes) * 100)
      : 0;

  const activeHistory =
    training && training.state === 'TRAINING' && training.config?.agentType === agentType && training.history.length > 0
      ? training.history
      : agentType === 'DQN'
        ? (training?.dqnHistory ?? [])
        : (training?.qLearningHistory ?? []);

  const agentSummary = agentType === 'DQN' ? training?.dqnSummary : training?.qLearningSummary;
  const latestEpMetric = activeHistory.length > 0 ? activeHistory[activeHistory.length - 1] : null;
  const displayedCurrentReward =
    training?.state === 'TRAINING' && training.config?.agentType === agentType
      ? training.currentReward
      : (latestEpMetric?.totalReward ?? null);
  const displayedAvgReward =
    training?.state === 'TRAINING' && training.config?.agentType === agentType
      ? training.averageReward
      : (agentSummary?.averageReward ?? null);
  const displayedBestReward =
    training?.state === 'TRAINING' && training.config?.agentType === agentType
      ? training.bestReward
      : (agentSummary?.bestReward ?? null);

  const handleStart = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const cfg: RLTrainingConfig = {
        agentType,
        workloadType,
        numProcesses,
        episodes,
        learningRate,
        discountFactor,
        epsilonStart,
        epsilonDecay,
        epsilonMin,
        batchSize,
        targetUpdateFreq,
        seed,
      };
      const snap = await rairaApi.startTraining(cfg);
      onTrainingUpdated(snap);
      if (snap.state === 'ERROR') {
        setFeedback({ tone: 'err', text: snap.error ?? 'Training failed to start.' });
      }
    } catch (err) {
      setFeedback({ tone: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleTrainBoth = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const snap = await rairaApi.trainBothAgents({
        workloadType,
        numProcesses,
        qEpisodes: agentType === 'Q_LEARNING' ? episodes : 30,
        dqnEpisodes: agentType === 'DQN' ? episodes : 15,
        discountFactor,
        seed,
      });
      onTrainingUpdated(snap);
      if (snap.state === 'ERROR') {
        setFeedback({ tone: 'err', text: snap.error ?? 'Sequential training failed to start.' });
      } else {
        setFeedback({
          tone: 'ok',
          text: 'Sequential training started: Tabular Q-Learning followed automatically by TensorFlow.js DQN.',
        });
      }
    } catch (err) {
      setFeedback({ tone: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    const snap = await rairaApi.pauseTraining();
    onTrainingUpdated(snap);
  };

  const handleResume = async () => {
    const snap = await rairaApi.resumeTraining();
    onTrainingUpdated(snap);
  };

  const handleStop = async () => {
    const snap = await rairaApi.stopTraining();
    onTrainingUpdated(snap);
    if (snap.history.length > 0) {
      onTrainingCompletedLog(snap);
    }
  };

  const handleResetAgent = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const snap = await rairaApi.resetRLAgent(agentType, seed);
      onTrainingUpdated(snap);
      setFeedback({
        tone: 'ok',
        text: `${agentType === 'DQN' ? 'DQN neural network weights and replay buffer' : 'Q-Learning table'} reset.`,
      });
    } catch (err) {
      setFeedback({ tone: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveCheckpoint = async () => {
    setFeedback(null);
    try {
      const model = await rairaApi.exportRLModel(agentType);
      experimentStorage.saveModelCheckpoint(agentType, model);
      exportService.downloadJson(
        model,
        `raira-${agentType.toLowerCase()}-checkpoint-${Date.now()}.json`
      );
      setFeedback({
        tone: 'ok',
        text: `Saved ${agentType} model checkpoint to browser storage and downloaded JSON file.`,
      });
    } catch (err) {
      setFeedback({ tone: 'err', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleLoadFromBrowser = async () => {
    setFeedback(null);
    const saved = experimentStorage.loadModelCheckpoint(agentType);
    if (!saved) {
      setFeedback({
        tone: 'err',
        text: `No saved ${agentType} checkpoint found in browser localStorage.`,
      });
      return;
    }
    try {
      const snap = await rairaApi.importRLModel(agentType, saved);
      onTrainingUpdated(snap);
      setFeedback({ tone: 'ok', text: `Restored ${agentType} checkpoint from localStorage.` });
    } catch (err) {
      setFeedback({ tone: 'err', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const snap = await rairaApi.importRLModel(agentType, parsed);
      onTrainingUpdated(snap);
      setFeedback({ tone: 'ok', text: `Imported ${agentType} checkpoint from ${file.name}.` });
    } catch (err) {
      setFeedback({ tone: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* DQN Dependency Error / Status Callout */}
      {agentType === 'DQN' && dqnStatus && !dqnStatus.available && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200 space-y-1"
        >
          <div className="font-semibold text-red-300">DQN TensorFlow.js Dependency Error</div>
          <p>{dqnStatus.error}</p>
          <p className="text-red-300/80">
            RAIRA does not substitute random actions when TensorFlow.js fails to initialize. Switch
            to Tabular Q-Learning or resolve the backend dependency.
          </p>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.tone === 'err' ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-3 text-xs ${
            feedback.tone === 'err'
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Top Training Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          label="Training Status"
          value={
            training?.state === 'IDLE' && agentSummary?.isTrained
              ? 'TRAINED'
              : (training?.state ?? 'IDLE')
          }
          detail={
            agentSummary?.isTrained
              ? `${agentSummary.episodesTrained} total ep trained`
              : 'Untrained agent'
          }
          tone={
            training?.state === 'TRAINING'
              ? 'cyan'
              : training?.state === 'COMPLETED' || (training?.state === 'IDLE' && agentSummary?.isTrained)
                ? 'emerald'
                : training?.state === 'ERROR'
                  ? 'red'
                  : 'default'
          }
        />
        <MetricCard
          label="Current Episode"
          value={
            training?.state === 'TRAINING' || training?.state === 'PAUSED'
              ? `${training.currentEpisode} / ${training.totalEpisodes}`
              : `${agentSummary?.episodesTrained ?? 0} ep`
          }
          detail={
            training?.state === 'TRAINING'
              ? `${progressPercent.toFixed(0)}% complete`
              : agentSummary?.isTrained
                ? 'Checkpoint ready'
                : 'Not trained yet'
          }
        />
        <MetricCard
          label="Latest Reward"
          value={
            displayedCurrentReward !== null && displayedCurrentReward !== undefined
              ? displayedCurrentReward.toFixed(2)
              : '—'
          }
          detail="Last completed episode"
          tone="cyan"
        />
        <MetricCard
          label="Average / Best Reward"
          value={
            displayedAvgReward !== null && displayedAvgReward !== undefined
              ? displayedAvgReward.toFixed(2)
              : '—'
          }
          detail={
            displayedBestReward !== null && displayedBestReward !== undefined
              ? `Best: ${displayedBestReward.toFixed(2)}`
              : 'No episodes yet'
          }
          tone="emerald"
        />
        <MetricCard
          label="Exploration (Epsilon)"
          value={(agentSummary?.epsilon ?? epsilonStart).toFixed(3)}
          detail={`Decay ${epsilonDecay} · Min ${epsilonMin}`}
        />
        <MetricCard
          label={agentType === 'DQN' ? 'DQN Huber Loss' : 'Q-Table States'}
          value={
            agentType === 'DQN'
              ? training?.dqnSummary.lastLoss !== null && training?.dqnSummary.lastLoss !== undefined
                ? training.dqnSummary.lastLoss.toFixed(4)
                : '—'
              : training?.qLearningSummary.qTableStates ?? 0
          }
          detail={
            agentType === 'DQN'
              ? `${dqnStatus?.parameterCount?.toLocaleString() ?? '112,737'} params (${dqnStatus?.backend ?? 'cpu'})`
              : `${training?.qLearningSummary.totalUpdates ?? 0} TD updates`
          }
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Config & Controls Panel */}
        <section className="xl:col-span-4 rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Agent &amp; Hyperparameters
            </h2>
            <p className="text-xs text-slate-400">
              Semi-Markov discounting (γ^τ) with strict valid-action masking
            </p>
          </div>

          {/* Agent Toggle */}
          <div
            role="group"
            aria-label="Select RL agent type"
            className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#080F1D] border border-slate-800"
          >
            <button
              type="button"
              disabled={isRunning}
              onClick={() => handleSwitchAgent('Q_LEARNING')}
              aria-pressed={agentType === 'Q_LEARNING'}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                agentType === 'Q_LEARNING'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tabular Q-Learning
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => handleSwitchAgent('DQN')}
              aria-pressed={agentType === 'DQN'}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                agentType === 'DQN'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Deep Q-Network (DQN)
            </button>
          </div>

          {agentType === 'DQN' && dqnStatus?.available && (
            <div className="rounded-lg border border-slate-800 bg-[#080F1D] px-3 py-2.5 text-[11px] font-mono text-slate-300 space-y-1">
              <div>TF.js v{dqnStatus.version} · Backend: {dqnStatus.backend}</div>
              <div className="text-slate-400">
                Network: 262 → 256 (ReLU) → 128 (ReLU) → 97 Q-values
              </div>
              <div className="text-slate-500">
                Adam · Huber Loss · Grad Clip 1.0 · Target Sync
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2">
              <label htmlFor="rl-workload" className="block text-slate-400 mb-1">
                Training Workload Scenario
              </label>
              <select
                id="rl-workload"
                value={workloadType}
                disabled={isRunning}
                onChange={(e) => setWorkloadType(e.target.value as Exclude<WorkloadType, 'CUSTOM'>)}
                className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="CPU_INTENSIVE">CPU-Intensive</option>
                <option value="MEMORY_INTENSIVE">Memory-Intensive</option>
                <option value="MIXED">Mixed Workload</option>
                <option value="DYNAMIC">Dynamic Workload</option>
              </select>
            </div>

            <div>
              <label htmlFor="rl-episodes" className="block text-slate-400 mb-1">
                Episodes (1–500)
              </label>
              <input
                id="rl-episodes"
                type="number"
                min={1}
                max={500}
                disabled={isRunning}
                value={episodes}
                onChange={(e) => setEpisodes(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rl-procs" className="block text-slate-400 mb-1">
                Processes / Episode
              </label>
              <input
                id="rl-procs"
                type="number"
                min={1}
                max={32}
                disabled={isRunning}
                value={numProcesses}
                onChange={(e) =>
                  setNumProcesses(Math.max(1, Math.min(32, Number(e.target.value) || 1)))
                }
                className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rl-lr" className="block text-slate-400 mb-1">
                Learning Rate (α)
              </label>
              <input
                id="rl-lr"
                type="number"
                step="0.0005"
                min={0.0001}
                max={1}
                disabled={isRunning}
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value) || 0.001)}
                className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rl-gamma" className="block text-slate-400 mb-1">
                Discount Factor (γ)
              </label>
              <input
                id="rl-gamma"
                type="number"
                step="0.01"
                min={0.1}
                max={0.999}
                disabled={isRunning}
                value={discountFactor}
                onChange={(e) => setDiscountFactor(Number(e.target.value) || 0.95)}
                className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rl-eps" className="block text-slate-400 mb-1">
                Exploration Rate (ε)
              </label>
              <input
                id="rl-eps"
                type="number"
                step="0.05"
                min={0.01}
                max={1}
                disabled={isRunning}
                value={epsilonStart}
                onChange={(e) => setEpsilonStart(Number(e.target.value) || 1.0)}
                className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rl-decay" className="block text-slate-400 mb-1">
                Epsilon Decay
              </label>
              <input
                id="rl-decay"
                type="number"
                step="0.01"
                min={0.5}
                max={0.999}
                disabled={isRunning}
                value={epsilonDecay}
                onChange={(e) => setEpsilonDecay(Number(e.target.value) || 0.95)}
                className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rl-seed" className="block text-slate-400 mb-1">
                Random Seed
              </label>
              <input
                id="rl-seed"
                type="number"
                disabled={isRunning}
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 42)}
                className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {agentType === 'DQN' ? (
              <div>
                <label htmlFor="rl-batch" className="block text-slate-400 mb-1">
                  DQN Batch Size
                </label>
                <input
                  id="rl-batch"
                  type="number"
                  min={8}
                  max={128}
                  disabled={isRunning}
                  value={batchSize}
                  onChange={(e) =>
                    setBatchSize(Math.max(8, Math.min(128, Number(e.target.value) || 32)))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="rl-eps-min" className="block text-slate-400 mb-1">
                  Minimum Epsilon
                </label>
                <input
                  id="rl-eps-min"
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={0.5}
                  disabled={isRunning}
                  value={epsilonMin}
                  onChange={(e) => setEpsilonMin(Number(e.target.value) || 0.05)}
                  className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Primary Training Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {!isRunning && !isPaused && (
              <>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={busy || Boolean(dqnUnavailable)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Start Training</span>
                </button>
                <button
                  type="button"
                  onClick={handleTrainBoth}
                  disabled={busy || Boolean(dqnStatus && !dqnStatus.available)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Train Both (Q + DQN)</span>
                </button>
              </>
            )}
            {isRunning && (
              <button
                type="button"
                onClick={handlePause}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pause</span>
              </button>
            )}
            {isPaused && (
              <button
                type="button"
                onClick={handleResume}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Resume</span>
              </button>
            )}
            {(isRunning || isPaused) && (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/25 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Stop</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleResetAgent}
              disabled={isRunning || busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Agent</span>
            </button>
          </div>

          {/* Model Checkpointing */}
          <div className="pt-3 border-t border-slate-800/70 space-y-2">
            <div className="text-xs font-medium text-slate-300">Model Checkpoints</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveCheckpoint}
                disabled={isRunning || !agentSummary?.isTrained}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Save Model</span>
              </button>
              <button
                type="button"
                onClick={handleLoadFromBrowser}
                disabled={isRunning}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Load Saved</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Import JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
                aria-label="Import RL model JSON file"
              />
            </div>
          </div>
        </section>

        {/* Right Live Training Charts */}
        <section className="xl:col-span-8 space-y-5">
          {/* Progress Bar */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-200">
                {training?.batchStageLabel
                  ? training.batchStageLabel
                  : `Training Session Progress · ${
                      (training?.config?.agentType ?? agentType) === 'DQN'
                        ? 'Deep Q-Network'
                        : 'Tabular Q-Learning'
                    }`}
              </span>
              <span className="font-mono tabular-nums text-cyan-400">
                {training?.state === 'TRAINING' || training?.state === 'PAUSED'
                  ? `${training.currentEpisode} / ${training.totalEpisodes} episodes (${progressPercent.toFixed(0)}%)`
                  : agentSummary?.isTrained
                    ? `${agentSummary.episodesTrained} episodes trained (100%)`
                    : '0 / 0 episodes (0%)'}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-900 overflow-hidden">
              <div
                style={{
                  width: `${
                    training?.state === 'TRAINING' || training?.state === 'PAUSED'
                      ? progressPercent
                      : agentSummary?.isTrained
                        ? 100
                        : 0
                  }%`,
                }}
                className="h-full bg-cyan-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Reward Progression Chart */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Episode Reward Progression
                </h3>
                <p className="text-xs text-slate-400">
                  Actual episode reward and 10-episode moving average (never hardcoded)
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {activeHistory.length} episodes plotted
              </span>
            </div>

            <div className="h-64 w-full">
              {activeHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
                  Click Start Training to observe real-time RL reward progression.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeHistory} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis
                      dataKey="episode"
                      stroke="#64748B"
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      tickFormatter={(v) => `Ep ${v}`}
                    />
                    <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="totalReward"
                      name="Episode Reward"
                      stroke="#38BDF8"
                      strokeWidth={1.75}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgRewardLast10"
                      name="10-Ep Moving Avg"
                      stroke="#10B981"
                      strokeWidth={2.25}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Secondary Metric Chart (DQN Loss or Waiting Time & Epsilon) */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5">
            <div className="mb-4">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                {agentType === 'DQN'
                  ? 'DQN Training Loss & Average Waiting Time'
                  : 'Average Waiting Time & Turnaround Time per Episode'}
              </h3>
              <p className="text-xs text-slate-400">
                Empirical scheduling quality measured directly from simulation state transitions
              </p>
            </div>

            <div className="h-56 w-full">
              {activeHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
                  Training diagnostics will appear here once episodes complete.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeHistory} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis
                      dataKey="episode"
                      stroke="#64748B"
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      tickFormatter={(v) => `Ep ${v}`}
                    />
                    <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="avgWaitingTime"
                      name="Avg Waiting Time (t)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {agentType === 'DQN' ? (
                      <Line
                        type="monotone"
                        dataKey="dqnLoss"
                        name="DQN Huber Loss"
                        stroke="#EF4444"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="avgTurnaroundTime"
                        name="Avg Turnaround (t)"
                        stroke="#818CF8"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
