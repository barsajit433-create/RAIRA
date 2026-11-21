import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryRateLimiter,
  isValidAlgorithm,
  isValidShockType,
  isValidWorkloadType,
  sanitizeProcessName,
  validateDQNImportPayload,
  validateNumericBounds,
  validateQLearningImportPayload,
  validateRewardWeightsInput,
} from './securityMiddleware.ts';
import { escapeCsvCell, sanitizeDownloadFilename } from '../../src/services/exportService.ts';
import { validateProcessInput } from '../../src/simulation/Process.ts';
import {
  getPretrainedDQNModel,
  getPretrainedQLearningModel,
} from '../../src/reinforcement-learning/pretrainedModels.ts';

describe('RAIRA 2.3 Security Hardening & Validation Suite', () => {
  it('validates algorithm, workload, and shock type allowlists strictly', () => {
    assert.equal(isValidAlgorithm('FCFS'), true);
    assert.equal(isValidAlgorithm('DQN'), true);
    assert.equal(isValidAlgorithm('BOGUS_ALG'), false);
    assert.equal(isValidAlgorithm(null), false);

    assert.equal(isValidWorkloadType('MIXED', false), true);
    assert.equal(isValidWorkloadType('CUSTOM', false), false);
    assert.equal(isValidWorkloadType('CUSTOM', true), true);
    assert.equal(isValidWorkloadType('SQL_INJECT', true), false);

    assert.equal(isValidShockType('CPU_SPIKE'), true);
    assert.equal(isValidShockType('INVALID_SHOCK'), false);
  });

  it('rejects prototype pollution keys and out-of-range reward weights', () => {
    const valid = validateRewardWeightsInput({ completionBaseBonus: 8, gamma: 0.95 });
    assert.equal(valid.valid, true);

    const protoPayload = JSON.parse('{"__proto__":{"polluted":true}}');
    const rejectedProto = validateRewardWeightsInput(protoPayload);
    assert.equal(rejectedProto.valid, false);

    const rejectedUnknown = validateRewardWeightsInput({ unknownKey: 5 });
    assert.equal(rejectedUnknown.valid, false);

    const rejectedBounds = validateRewardWeightsInput({ gamma: 1.5 });
    assert.equal(rejectedBounds.valid, false);

    const rejectedNaN = validateRewardWeightsInput({ waitingPenaltyWeight: Number.NaN });
    assert.equal(rejectedNaN.valid, false);
  });

  it('neutralizes CSV formula injection while preserving finite numeric values', () => {
    // Formula prefixes on string cells must be prefixed with single quote
    assert.equal(escapeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.equal(escapeCsvCell('+1+1'), "'+1+1");
    assert.equal(escapeCsvCell('-2+3'), "'-2+3");
    assert.equal(escapeCsvCell('@SUM(1,1)'), `"'@SUM(1,1)"`);
    assert.equal(escapeCsvCell('  =HYPERLINK("http://example.com")'), `"'  =HYPERLINK(""http://example.com"")"`);

    // Genuine numeric values (including negative rewards) stay clean numbers
    assert.equal(escapeCsvCell(-14.25), '-14.25');
    assert.equal(escapeCsvCell(0), '0');
    assert.equal(escapeCsvCell('Normal Process'), 'Normal Process');
  });

  it('sanitizes export filenames against path traversal and control characters', () => {
    assert.equal(
      sanitizeDownloadFilename('../../etc/passwd', '.csv'),
      '.-.-etc-passwd.csv'
    );
    assert.equal(
      sanitizeDownloadFilename('report\x00name', '.json'),
      'reportname.json'
    );
    assert.equal(sanitizeDownloadFilename('raira-experiments.csv', '.csv'), 'raira-experiments.csv');
  });

  it('strips control characters and validates process names cleanly', () => {
    assert.equal(sanitizeProcessName('  worker\x00\x1f-01  '), 'worker-01');

    const ctrlCheck = validateProcessInput({
      name: 'proc\nname',
      arrivalTime: 0,
      cpuBurstTime: 5,
      priority: 3,
      memoryDemand: 256,
    });
    assert.equal(ctrlCheck.valid, false);
    assert.ok(ctrlCheck.errors.name);
  });

  it('validates Q-Learning and DQN model checkpoint imports and accepts bundled pretrained models', () => {
    assert.equal(validateQLearningImportPayload(getPretrainedQLearningModel()).valid, true);
    assert.equal(validateDQNImportPayload(getPretrainedDQNModel()).valid, true);

    const badQ = JSON.parse('{"version":"raira-qtable-v1","qTable":{"__proto__":1}}');
    assert.equal(validateQLearningImportPayload(badQ).valid, false);

    const badDqn = {
      version: 'raira-dqn-v1',
      weights: [{ shape: [-5, 10], dataBase64: 'AAAA' }],
    };
    assert.equal(validateDQNImportPayload(badDqn).valid, false);

    const badB64Length = {
      version: 'raira-dqn-v1',
      weights: [{ shape: [4], dataBase64: 'AAAA' }], // 3 bytes instead of 16 bytes
    };
    assert.equal(validateDQNImportPayload(badB64Length).valid, false);
  });

  it('enforces numeric bounds and fixed-window in-memory rate limiting cleanly', () => {
    assert.equal(validateNumericBounds(10, 'numProcesses', 1, 32, true).valid, true);
    assert.equal(validateNumericBounds(10.5, 'numProcesses', 1, 32, true).valid, false);
    assert.equal(validateNumericBounds(99, 'numProcesses', 1, 32, true).valid, false);

    let now = 1000;
    const limiter = new InMemoryRateLimiter({ windowMs: 10_000, maxRequests: 2, nowFn: () => now });
    assert.equal(limiter.check('ip:1').allowed, true);
    assert.equal(limiter.check('ip:1').allowed, true);
    assert.equal(limiter.check('ip:1').allowed, false);

    // Advance window -> allowed again
    now += 10_001;
    assert.equal(limiter.check('ip:1').allowed, true);
  });

  it('enforces same-origin / forwarded-host CORS and blocks untrusted cross-origin requests', async () => {
    const { apiCorsGuard, applySecurityHeaders } = await import('./securityMiddleware.ts');

    const makeMockRes = () => {
      const headers: Record<string, string> = {};
      let statusCode = 200;
      let body: unknown = null;
      return {
        headers,
        getStatus: () => statusCode,
        getBody: () => body,
        setHeader(k: string, v: string) {
          headers[k.toLowerCase()] = v;
        },
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: unknown) {
          body = payload;
          return this;
        },
        end() {
          return this;
        },
      };
    };

    // Security headers on /api path
    const hdrRes = makeMockRes();
    let hdrNext = false;
    applySecurityHeaders(
      { path: '/api/health' } as never,
      hdrRes as never,
      () => {
        hdrNext = true;
      }
    );
    assert.equal(hdrNext, true);
    assert.equal(hdrRes.headers['x-content-type-options'], 'nosniff');
    assert.equal(hdrRes.headers['cache-control'], 'no-store');
    assert.equal(hdrRes.headers['cross-origin-resource-policy'], 'same-origin');
    assert.ok(hdrRes.headers['content-security-policy']?.includes("object-src 'none'"));

    // Untrusted cross-origin blocked with 403
    const evilRes = makeMockRes();
    let evilNext = false;
    apiCorsGuard(
      { headers: { origin: 'https://evil.example', host: 'localhost:3000' }, method: 'POST' } as never,
      evilRes as never,
      () => {
        evilNext = true;
      }
    );
    assert.equal(evilNext, false);
    assert.equal(evilRes.getStatus(), 403);

    // Same-origin via X-Forwarded-Host allowed
    const fwdRes = makeMockRes();
    let fwdNext = false;
    apiCorsGuard(
      {
        headers: {
          origin: 'https://raira.example.run.app',
          host: 'localhost:3000',
          'x-forwarded-host': 'raira.example.run.app',
        },
        method: 'POST',
      } as never,
      fwdRes as never,
      () => {
        fwdNext = true;
      }
    );
    assert.equal(fwdNext, true);
    assert.equal(fwdRes.headers['access-control-allow-origin'], 'https://raira.example.run.app');
  });
});
