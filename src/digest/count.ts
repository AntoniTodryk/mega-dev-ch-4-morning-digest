import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isNight, parseLine } from './read.js';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

/** Counts parsed lines by status. Bad lines are skipped, never counted. */
export function countLines(text: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) counts[line.status]++;
  }
  return counts;
}

/** Per-line ok / retry / fail counts for `<runsDir>/<night>.jsonl`; `null` when unreadable. */
export function countNight(runsDir: string, night: string): NightCounts | null {
  if (!isNight(night)) return null;
  try {
    return countLines(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
