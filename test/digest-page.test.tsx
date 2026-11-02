import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders a night as one table, flagged rows marked', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<title>rig · digest 2026-10-28</title>');
    expect(html.match(/<table>/g)).toHaveLength(1);
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('2026-10-28T23:00:02+01:00');
    expect(html).toContain('<strong>3 !</strong>');
  });

  it('404s a night with no file', async () => {
    const res = await createApp(config).request('/digest/1999-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no log for that night');
  });

  it('empty file says nothing ran; bad lines and missing data shown', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    writeFileSync(
      join(dir, '2026-01-02.jsonl'),
      '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"fail"}\nnope\n',
    );
    const app = createApp({ ...config, runsDir: dir });
    expect(await (await app.request('/digest/2026-01-01')).text()).toContain('nothing ran');
    const html = await (await app.request('/digest/2026-01-02')).text();
    expect(html).toContain('1 line did not parse');
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('<strong>fail !</strong>');
  });
});
