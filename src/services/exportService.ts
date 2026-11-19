import type { ExperimentRecord, SeedComparisonBatch } from '../types/experiment';

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
};
