import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';
import type { Night } from '../src/digest/types.js';

const NORMAL = '2026-11-01';
const EMPTY = '2026-11-02';
const BAD = '2026-11-03';
const NO_OWNER = '2026-11-04';
const MISSING = '2026-11-05';

const line = (o: Record<string, unknown>) => JSON.stringify(o);

const fixtures: Record<string, string> = {
  // Written out of job order on purpose: the routes must sort by job.
  [NORMAL]: [
    line({ at: '2026-11-01T02:00:00+01:00', job: 'notes/backup', status: 'ok', owner: 'ana', error: null }),
    line({ at: '2026-11-01T02:05:00+01:00', job: 'digest/render', status: 'retry', owner: 'bo', error: 'timeout' }),
    line({ at: '2026-11-01T02:06:00+01:00', job: 'digest/render', status: 'ok', owner: 'bo', error: null }),
    line({ at: '2026-11-01T02:10:00+01:00', job: 'lane/sync', status: 'fail', owner: 'cy', error: 'disk full' }),
  ].join('\n') + '\n',
  [EMPTY]: '',
  [BAD]: [
    line({ at: '2026-11-03T02:00:00+01:00', job: 'notes/backup', status: 'ok', owner: 'ana', error: null }),
    '{ this is not json',
    line({ at: '2026-11-03T02:10:00+01:00', job: 'lane/sync', status: 'ok', owner: 'cy', error: null }),
  ].join('\n') + '\n',
  [NO_OWNER]: [
    line({ at: '2026-11-04T02:00:00+01:00', job: 'orphan/job', status: 'ok', owner: null, error: null }),
    line({ at: '2026-11-04T02:10:00+01:00', job: 'lane/sync', status: 'ok', owner: 'cy', error: null }),
  ].join('\n') + '\n',
};

let tmp: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  for (const [night, text] of Object.entries(fixtures)) {
    writeFileSync(join(tmp, `${night}.jsonl`), text);
  }
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: tmp,
  });
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Jobs as they appear in the page, in document order. */
function jobsInPage(html: string, jobs: string[]): string[] {
  return jobs
    .map((job) => ({ job, at: html.indexOf(job) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.job);
}

/** The `<tr>` that mentions `job`, or '' when none does. */
function rowFor(html: string, job: string): string {
  return html.split(/<tr[\s>]/).find((seg) => seg.includes(job))?.split('</tr>')[0] ?? '';
}

describe('GET /digest/:night', () => {
  it('renders a table with rows sorted by job', async () => {
    const res = await app.request(`/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<table');
    const jobs = ['notes/backup', 'digest/render', 'lane/sync'];
    for (const job of jobs) expect(rowFor(html, job)).not.toBe('');
    expect(jobsInPage(html, jobs)).toEqual(['digest/render', 'lane/sync', 'notes/backup']);
  });

  it('answers 404 when the night has no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty file', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders the good rows when a line is bad', async () => {
    const res = await app.request(`/digest/${BAD}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(rowFor(html, 'notes/backup')).not.toBe('');
    expect(rowFor(html, 'lane/sync')).not.toBe('');
  });

  it('shows a null owner as —', async () => {
    const res = await app.request(`/digest/${NO_OWNER}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    const row = rowFor(html, 'orphan/job');
    expect(row).not.toBe('');
    expect(row).toContain('—');
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 with exactly what readNight returns', async () => {
    const res = await app.request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body).toEqual(readNight(tmp, NORMAL));
    expect(Object.keys(body).sort()).toEqual(['badLines', 'night', 'rows']);
  });

  it('answers 404 when the night has no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('gives rows [] for an empty file', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body).toEqual({ night: EMPTY, rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the good rows', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup']);
    expect(body).toEqual(readNight(tmp, BAD));
  });

  it('keeps a null owner as null', async () => {
    const res = await app.request(`/api/digest/${NO_OWNER}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows.find((r) => r.job === 'orphan/job')?.owner).toBeNull();
  });
});

describe('page and JSON agree', () => {
  it.each([NORMAL, BAD, NO_OWNER])('list the same jobs in the same order for %s', async (night) => {
    const api = await app.request(`/api/digest/${night}`);
    expect(api.status).toBe(200);
    const jobs = ((await api.json()) as Night).rows.map((r) => r.job);
    const page = await app.request(`/digest/${night}`);
    expect(page.status).toBe(200);
    expect(jobsInPage(await page.text(), jobs)).toEqual(jobs);
  });
});
