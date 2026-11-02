import type { DigestRow, Night } from '../digest/types.js';

const DASH = '—';

// A row needs a look when it retried 3+ times or ended in `fail`. The mark is textual too
// (bold + " !"), so it survives a read without colour.
function flagged(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function Warn({ on, children }: { on: boolean; children: string | number }) {
  return on ? (
    <td class="warn">
      <strong>{children} !</strong>
    </td>
  ) : (
    <td>{children}</td>
  );
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} did not parse
        </p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <tr class={flagged(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? DASH}</td>
                <td>{row.runs}</td>
                <Warn on={row.retries >= 3}>{row.retries}</Warn>
                <Warn on={row.lastStatus === 'fail'}>{row.lastStatus}</Warn>
                <td>{row.lastError ?? DASH}</td>
                <td>{row.first}</td>
                <td>{row.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="mute">no log for that night</p>
    </>
  );
}
