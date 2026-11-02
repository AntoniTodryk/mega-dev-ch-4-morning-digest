// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night, folded from every log line it wrote. */
export type DigestRow = {
  job: string;
  /** `null` when the log says so; views render it as `—`. */
  owner: string | null;
  /** Lines this job wrote, retries included. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** Most recent `error` this job logged during the night, or `null`. */
  lastError: string | null;
  /** `at` of the first and last line, offset kept as logged. */
  first: string;
  last: string;
};

export type Night = {
  night: string;
  /** Sorted by job. Page and JSON both use this order (ADR 0001). */
  rows: DigestRow[];
  /** Lines that did not parse as a run record. Counted, never thrown. */
  badLines: number;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. Returns `null` when the night has no file
 * (or `night` is not `YYYY-MM-DD`); an empty file gives `rows: []`.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
