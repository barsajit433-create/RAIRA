import { SYSTEM_CONFIG } from '../types/simulation';
import type { ProcessRecord } from '../types/process';

export class ResourceManager {
  readonly totalRamMb: number;
  private allocatedRamMb: number = 0;
  private reservations: Map<string, number> = new Map();

  constructor(totalRamMb: number = SYSTEM_CONFIG.TOTAL_RAM_MB) {
    this.totalRamMb = totalRamMb;
  }

  reset(): void {
    this.allocatedRamMb = 0;
    this.reservations.clear();
  }

  getAllocatedRamMb(): number {
    return this.allocatedRamMb;
  }

  getAvailableRamMb(): number {
    return this.totalRamMb - this.allocatedRamMb;
  }

  getRamUtilisationPercent(): number {
    return (this.allocatedRamMb / this.totalRamMb) * 100;
  }

  canAllocate(memoryDemandMb: number): boolean {
    return memoryDemandMb >= 0 && this.allocatedRamMb + memoryDemandMb <= this.totalRamMb;
  }

  hasReservation(processId: string): boolean {
    return this.reservations.has(processId);
  }

  /**
   * Reserve full RAM demand for a process when admitted from BLOCKED.
   * Strictly prevents over-allocation beyond totalRamMb (4096 MB).
   */
  allocate(process: ProcessRecord): boolean {
    if (this.reservations.has(process.id)) {
      return true;
    }
    if (!this.canAllocate(process.memoryDemand)) {
      return false;
    }
    this.allocatedRamMb += process.memoryDemand;
    this.reservations.set(process.id, process.memoryDemand);
    process.allocatedMemory = process.memoryDemand;
    return true;
  }

  /**
   * Release reserved RAM strictly upon process completion.
   * Preemption must NOT call release().
   */
  release(process: ProcessRecord): number {
    const reserved = this.reservations.get(process.id) ?? 0;
    if (reserved > 0) {
      this.allocatedRamMb = Math.max(0, this.allocatedRamMb - reserved);
      this.reservations.delete(process.id);
    }
    process.allocatedMemory = 0;
    return reserved;
  }

  /** Assert strict memory safety invariants for testing and runtime verification */
  verifyInvariants(processes: ProcessRecord[]): { ok: boolean; reason?: string } {
    let sum = 0;
    for (const p of processes) {
      if (p.allocatedMemory < 0) {
        return { ok: false, reason: `Negative allocated memory on ${p.id}` };
      }
      if (p.status === 'COMPLETED' && p.allocatedMemory !== 0) {
        return { ok: false, reason: `Completed process ${p.id} still holds ${p.allocatedMemory} MB` };
      }
      if ((p.status === 'READY' || p.status === 'RUNNING') && p.allocatedMemory !== p.memoryDemand) {
        return { ok: false, reason: `Active process ${p.id} (${p.status}) missing reserved RAM` };
      }
      sum += p.allocatedMemory;
    }
    if (sum !== this.allocatedRamMb) {
      return { ok: false, reason: `RAM ledger mismatch: sum=${sum}, ledger=${this.allocatedRamMb}` };
    }
    if (this.allocatedRamMb > this.totalRamMb) {
      return { ok: false, reason: `RAM capacity exceeded: ${this.allocatedRamMb} > ${this.totalRamMb}` };
    }
    return { ok: true };
  }
}
