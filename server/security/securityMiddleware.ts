import type { NextFunction, Request, Response } from 'express';
import { SYSTEM_CONFIG, type AlgorithmType, type RewardWeights } from '../../src/types/simulation.ts';
import type { WorkloadType } from '../../src/types/process.ts';
import type { ShockType } from '../../src/types/intelligence.ts';

export const ALLOWED_ALGORITHMS: ReadonlySet<AlgorithmType> = new Set([
  'FCFS',
  'RR',
  'PRIORITY',
  'Q_LEARNING',
  'DQN',
]);

export const ALLOWED_WORKLOAD_TYPES: ReadonlySet<WorkloadType> = new Set([
  'CPU_INTENSIVE',
  'MEMORY_INTENSIVE',
  'MIXED',
  'DYNAMIC',
  'CUSTOM',
]);

export const ALLOWED_GENERATED_WORKLOAD_TYPES: ReadonlySet<Exclude<WorkloadType, 'CUSTOM'>> = new Set([
  'CPU_INTENSIVE',
  'MEMORY_INTENSIVE',
  'MIXED',
  'DYNAMIC',
]);

export const ALLOWED_SHOCK_TYPES: ReadonlySet<ShockType> = new Set([
  'CPU_SPIKE',
  'MEMORY_BURST',
  'HIGH_PRIORITY_BURST',
  'SIMULTANEOUS_ARRIVALS',
  'SEVERE_RAM_PRESSURE',
]);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isValidAlgorithm(value: unknown): value is AlgorithmType {
  return typeof value === 'string' && ALLOWED_ALGORITHMS.has(value as AlgorithmType);
}

export function isValidWorkloadType(value: unknown, allowCustom: boolean = true): value is WorkloadType {
  if (typeof value !== 'string') return false;
  return allowCustom
    ? ALLOWED_WORKLOAD_TYPES.has(value as WorkloadType)
    : ALLOWED_GENERATED_WORKLOAD_TYPES.has(value as Exclude<WorkloadType, 'CUSTOM'>);
}

export function isValidGeneratedWorkloadType(
  value: unknown
): value is Exclude<WorkloadType, 'CUSTOM'> {
  return (
    typeof value === 'string' &&
    ALLOWED_GENERATED_WORKLOAD_TYPES.has(value as Exclude<WorkloadType, 'CUSTOM'>)
  );
}

export function isValidShockType(value: unknown): value is ShockType {
  return typeof value === 'string' && ALLOWED_SHOCK_TYPES.has(value as ShockType);
}

export function sanitizeProcessName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // Strip ASCII control characters (0x00-0x1F, 0x7F) and trim
  return raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

export function validateRewardWeightsInput(
  raw: unknown
): { valid: true; value: Partial<RewardWeights> } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'rewardWeights must be a plain object.' };
  }

  const allowedNumericKeys: Array<keyof RewardWeights> = [
    'cpuRewardWeight',
    'completionBaseBonus',
    'priorityCompletionBonus',
    'waitingPenaltyWeight',
    'turnaroundPenaltyWeight',
    'fairnessWeight',
    'invalidActionPenalty',
    'gamma',
  ];

  const clean: Partial<RewardWeights> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k)) {
      return { valid: false, error: `Forbidden key in rewardWeights: ${k}` };
    }
    if (!allowedNumericKeys.includes(k as keyof RewardWeights)) {
      return { valid: false, error: `Unknown rewardWeights key: ${k}` };
    }
    const num = Number(v);
    if (!Number.isFinite(num)) {
      return { valid: false, error: `rewardWeights.${k} must be a finite number.` };
    }
    if (k === 'gamma') {
      if (num < 0.1 || num > 0.999) {
        return { valid: false, error: 'rewardWeights.gamma must be between 0.1 and 0.999.' };
      }
    } else if (num < -50 || num > 50) {
      return { valid: false, error: `rewardWeights.${k} must be between -50 and 50.` };
    }
    clean[k as keyof RewardWeights] = num;
  }

  return { valid: true, value: clean };
}

export function validateQLearningImportPayload(
  raw: unknown
): { valid: true } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Q-Learning checkpoint payload must be a JSON object.' };
  }
  const data = raw as Record<string, unknown>;
  if (data.version !== 'raira-qtable-v1') {
    return { valid: false, error: 'Unsupported Q-Learning checkpoint version.' };
  }
  if (!data.qTable || typeof data.qTable !== 'object' || Array.isArray(data.qTable)) {
    return { valid: false, error: 'Invalid Q-Learning qTable structure.' };
  }
  const entries = Object.entries(data.qTable as Record<string, unknown>);
  if (entries.length > 50_000) {
    return { valid: false, error: 'Q-Learning qTable exceeds maximum allowed size (50,000 entries).' };
  }
  for (const [k, v] of entries) {
    if (FORBIDDEN_KEYS.has(k) || k.length > 256) {
      return { valid: false, error: 'Q-Learning qTable contains a forbidden or oversized key.' };
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return { valid: false, error: 'Q-Learning qTable values must be finite numbers.' };
    }
  }
  if (data.history !== undefined && (!Array.isArray(data.history) || data.history.length > 500)) {
    return { valid: false, error: 'Q-Learning history must be an array of at most 500 episodes.' };
  }
  return { valid: true };
}

export function validateDQNImportPayload(
  raw: unknown
): { valid: true } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'DQN checkpoint payload must be a JSON object.' };
  }
  const data = raw as Record<string, unknown>;
  if (data.version !== 'raira-dqn-v1') {
    return { valid: false, error: 'Unsupported DQN checkpoint version.' };
  }
  if (!Array.isArray(data.weights) || data.weights.length === 0 || data.weights.length > 16) {
    return { valid: false, error: 'DQN checkpoint weights must contain between 1 and 16 tensors.' };
  }

  let totalPayloadUnits = 0;
  for (const tensor of data.weights) {
    if (!tensor || typeof tensor !== 'object' || Array.isArray(tensor)) {
      return { valid: false, error: 'Invalid tensor entry in DQN checkpoint.' };
    }
    const t = tensor as Record<string, unknown>;
    if (
      !Array.isArray(t.shape) ||
      t.shape.length === 0 ||
      t.shape.length > 4 ||
      !t.shape.every((d) => typeof d === 'number' && Number.isInteger(d) && d > 0 && d <= 4096)
    ) {
      return { valid: false, error: 'Invalid tensor shape in DQN checkpoint.' };
    }
    const expectedElems = (t.shape as number[]).reduce((acc, dim) => acc * dim, 1);
    if (expectedElems > 200_000) {
      return { valid: false, error: 'Tensor shape exceeds maximum supported size.' };
    }

    if (Array.isArray(t.data)) {
      if (t.data.length !== expectedElems) {
        return { valid: false, error: 'Tensor data length does not match shape.' };
      }
      if (!t.data.every((v) => typeof v === 'number' && Number.isFinite(v))) {
        return { valid: false, error: 'Tensor data must contain only finite numbers.' };
      }
      totalPayloadUnits += t.data.length * 4;
    } else if (typeof t.dataBase64 === 'string' && t.dataBase64.length > 0) {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(t.dataBase64) || t.dataBase64.length % 4 !== 0) {
        return { valid: false, error: 'Invalid base64 encoding in DQN checkpoint tensor.' };
      }
      const padding = t.dataBase64.endsWith('==') ? 2 : t.dataBase64.endsWith('=') ? 1 : 0;
      const decodedBytes = (t.dataBase64.length / 4) * 3 - padding;
      if (decodedBytes !== expectedElems * 4) {
        return { valid: false, error: 'Base64 tensor byte length does not match shape.' };
      }
      totalPayloadUnits += t.dataBase64.length;
    } else {
      return { valid: false, error: 'Missing numeric or base64 tensor weights in DQN checkpoint.' };
    }

    if (totalPayloadUnits > 3 * 1024 * 1024) {
      return { valid: false, error: 'DQN checkpoint weight payload exceeds maximum size (3 MB).' };
    }
  }

  if (data.history !== undefined && (!Array.isArray(data.history) || data.history.length > 500)) {
    return { valid: false, error: 'DQN history must be an array of at most 500 episodes.' };
  }
  return { valid: true };
}

export function validateNumericBounds(
  value: unknown,
  field: string,
  min: number,
  max: number,
  integerOnly: boolean = false
): { valid: true; value: number } | { valid: false; error: string } {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { valid: false, error: `${field} must be a finite number.` };
  }
  if (integerOnly && !Number.isInteger(num)) {
    return { valid: false, error: `${field} must be an integer.` };
  }
  if (num < min || num > max) {
    return { valid: false, error: `${field} must be between ${min} and ${max}.` };
  }
  return { valid: true, value: num };
}

export function validateMaxProcessCount(raw: unknown): { valid: true; value: number } | { valid: false; error: string } {
  return validateNumericBounds(raw, 'numProcesses', 1, SYSTEM_CONFIG.MAX_PROCESSES, true);
}

/**
 * Defensive HTTP response headers middleware.
 * Intentionally avoids X-Frame-Options: DENY so embedded iframe previews remain functional.
 */
export function applySecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Content-Security-Policy', "base-uri 'self'; object-src 'none'; form-action 'self'");

  if (req.path.startsWith('/api')) {
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

/**
 * Explicit same-origin / allowlisted CORS policy for API endpoints (no wildcard '*').
 */
export function apiCorsGuard(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }

  const host = req.headers.host;
  const forwardedHostHeader = req.headers['x-forwarded-host'];
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]?.split(',')[0]?.trim()
    : forwardedHostHeader?.split(',')[0]?.trim();
  const extraOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let isAllowed = false;
  try {
    const parsedOrigin = new URL(origin);
    if (
      (host && parsedOrigin.host === host) ||
      (forwardedHost && parsedOrigin.host === forwardedHost)
    ) {
      isAllowed = true;
    } else if (extraOrigins.includes(origin)) {
      isAllowed = true;
    }
  } catch {
    isAllowed = false;
  }

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
    return;
  }

  res.status(403).json({ error: 'Cross-origin request blocked by CORS policy.' });
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  nowFn?: () => number;
}

/**
 * Pure, testable in-memory fixed-window rate limiter store.
 */
export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly nowFn: () => number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = Math.max(1000, options.windowMs);
    this.maxRequests = Math.max(1, options.maxRequests);
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = this.nowFn();
    // Periodic cleanup if bucket map grows large
    if (this.buckets.size > 1000) {
      for (const [k, b] of this.buckets.entries()) {
        if (b.resetAt <= now) this.buckets.delete(k);
      }
    }

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - 1),
        resetMs: this.windowMs,
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, existing.resetAt - now),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - existing.count),
      resetMs: Math.max(0, existing.resetAt - now),
    };
  }
}

export function createRateLimitMiddleware(options: RateLimiterOptions & { bucketPrefix: string }) {
  const limiter = new InMemoryRateLimiter(options);
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = limiter.check(`${options.bucketPrefix}:${clientIp}`);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil(result.resetMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait briefly before repeating this request.',
      });
      return;
    }
    next();
  };
}
