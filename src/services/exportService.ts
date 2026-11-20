import type { ExperimentRecord, SeedComparisonBatch } from '../types/experiment';
import type {
  CounterfactualReport,
  ShockArenaReport,
  StatisticalValidationReport,
} from '../types/intelligence';

function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const exportService = {
  downloadJson(data: unknown, filename: string): void {
    const json = JSON.stringify(data, null, 2);
    triggerFileDownload(json, filename.endsWith('.json') ? filename : `${filename}.json`, 'application/json');
  },

  downloadCsv(rows: Record<string, unknown>[], filename: string): void {
    if (rows.length === 0) {
      triggerFileDownload('', filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv;charset=utf-8;');
      return;
    }
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(',')),
    ];
    triggerFileDownload(
      lines.join('\n'),
      filename.endsWith('.csv') ? filename : `${filename}.csv`,
      'text/csv;charset=utf-8;'
    );
  },

  exportExperimentsCsv(records: ExperimentRecord[], filename = 'raira-experiments.csv'): void {
    const rows = records.map((r) => ({
      experiment_id: r.id,
      timestamp: r.timestamp,
      algorithm: r.algorithm,
      trained_model: r.isTrainedModel ? 'Yes' : 'Untrained',
      provenance: r.provenance,
      workload_type: r.workloadType,
      num_processes: r.numProcesses,
      seed: r.seed,
      episodes: r.episodes,
      avg_waiting_time: r.avgWaitingTime,
      avg_turnaround_time: r.avgTurnaroundTime,
      avg_response_time: r.avgResponseTime,
      cpu_utilisation_pct: r.cpuUtilisation,
      ram_utilisation_pct: r.ramUtilisation,
      throughput_per_100t: r.throughput,
      jain_fairness: r.jainFairness,
      episode_reward: r.reward,
      reward_preset: r.rewardPreset ?? 'BALANCED',
      notes: r.notes ?? '',
    }));
    this.downloadCsv(rows, filename);
  },

  exportComparisonCsv(batch: SeedComparisonBatch, filename = 'raira-comparison.csv'): void {
    const rows = batch.aggregated.map((a) => ({
      comparison_id: batch.id,
      timestamp: batch.timestamp,
      workload_type: batch.workloadType,
      num_processes: batch.numProcesses,
      seeds: batch.seeds.join(';'),
      rr_quantum: batch.rrQuantum,
      algorithm: a.algorithm,
      available: a.available,
      trained_model: a.isTrainedModel,
      provenance: a.provenance,
      avg_cpu_util_pct: a.avgCpuUtilisation,
      avg_ram_util_pct: a.avgRamUtilisation,
      avg_waiting_time: a.avgWaitingTime,
      avg_turnaround_time: a.avgTurnaroundTime,
      avg_response_time: a.avgResponseTime,
      throughput_per_100t: a.throughput,
      jain_fairness: a.jainFairnessIndex,
      avg_episode_reward: a.avgEpisodeReward,
      rank_by_waiting_time: a.rankByWaitingTime ?? 'N/A',
      rank_by_reward: a.rankByReward ?? 'N/A',
    }));
    this.downloadCsv(rows, filename);
  },

  exportStatisticalValidationCsv(
    report: StatisticalValidationReport,
    filename = 'raira-statistical-validation.csv'
  ): void {
    const rows = report.overallSummaries.map((s) => ({
      report_id: report.id,
      timestamp: report.timestamp,
      seed_start: report.config.seedStart,
      seed_count: report.config.seedCount,
      disjoint_from_training: report.disjointFromTrainingSeeds,
      workloads: report.config.workloads.join(';'),
      policy: s.label,
      algorithm: s.algorithm,
      trained_model: s.isTrainedModel,
      samples: s.sampleCount,
      wait_mean: s.waitingTime.mean,
      wait_std: s.waitingTime.stdDev,
      wait_ci95_low: s.waitingTime.ci95Low,
      wait_ci95_high: s.waitingTime.ci95High,
      wait_median: s.waitingTime.median,
      wait_p95: s.waitingTime.p95,
      turnaround_mean: s.turnaroundTime.mean,
      cpu_util_mean: s.cpuUtilisation.mean,
      ram_util_mean: s.ramUtilisation.mean,
      throughput_mean: s.throughput.mean,
      jain_fairness_mean: s.jainFairness.mean,
      service_share_fairness_mean: s.serviceShareFairness.mean,
      reward_mean: s.episodeReward.mean,
      reward_std: s.episodeReward.stdDev,
      invalid_actions_total: s.invalidActionsTotal,
      starvation_events_total: s.starvationEventsTotal,
    }));
    this.downloadCsv(rows, filename);
  },

  exportShockArenaCsv(report: ShockArenaReport, filename = 'raira-shock-arena.csv'): void {
    const rows = report.results.map((r) => ({
      report_id: report.id,
      shock_type: report.config.shockType,
      injection_tick: r.injectionTick,
      additional_processes: report.config.additionalProcesses,
      algorithm: r.algorithm,
      trained_model: r.isTrainedModel,
      recovery_ticks: r.recoveryTicks ?? 'NOT_STABILIZED',
      max_queue_length: r.maxQueueLength,
      max_waiting_time: r.maxWaitingTime,
      cpu_util_drop_pct: r.cpuUtilDropPct,
      peak_ram_pressure_pct: r.peakRamPressurePct,
      throughput_reduction_pct: r.throughputReductionPct,
      starvation_events: r.starvationEvents,
      final_avg_wait: r.finalMetrics.avgWaitingTime,
      final_throughput: r.finalMetrics.throughput,
      final_reward: r.finalMetrics.totalEpisodeReward,
    }));
    this.downloadCsv(rows, filename);
  },

  exportCounterfactualCsv(
    report: CounterfactualReport,
    filename = 'raira-counterfactual.csv'
  ): void {
    const rows = report.branches.map((b) => ({
      report_id: report.id,
      branch_tick: report.startTick,
      horizon: report.horizonTicks,
      branch_id: b.branchId,
      policy: b.label,
      initial_action: b.initialActionLabel,
      cpu_util_pct: b.metrics.avgCpuUtilisation,
      ram_util_pct: b.metrics.avgRamUtilisation,
      avg_waiting_time: b.metrics.avgWaitingTime,
      avg_turnaround_time: b.metrics.avgTurnaroundTime,
      throughput: b.metrics.throughput,
      resource_violations: b.metrics.resourceViolations,
      jain_fairness: b.metrics.jainFairnessIndex,
      episode_reward: b.metrics.totalEpisodeReward,
      delta_wait_vs_selected: b.deltasVsSelected.waitingTimeDelta,
      delta_reward_vs_selected: b.deltasVsSelected.rewardDelta,
    }));
    this.downloadCsv(rows, filename);
  },
};
