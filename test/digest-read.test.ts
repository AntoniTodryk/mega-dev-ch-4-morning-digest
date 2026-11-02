import { describe, expect, it } from 'vitest';
import { foldNight, readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('folds runs/2026-10-28.jsonl into 5 jobs and counts the bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const refresh = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });
    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('keeps a row whose owner is null', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render')!;
    expect(row.owner).toBeNull();
  });

  it('returns null for a night with no file or a malformed night', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    expect(foldNight('2026-01-01', '')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts records with a wrong shape as bad lines', () => {
    const text = ['{"at":"x","job":"a","status":"maybe"}', '[]', 'null', '{"job":"a","status":"ok"}'].join('\n');
    expect(foldNight('n', text).badLines).toBe(4);
  });
});
