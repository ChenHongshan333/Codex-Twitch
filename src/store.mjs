import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Atomic config writes and a bounded event trail; no external database to install.
export class Store {
  constructor(directory) { this.directory = directory; mkdirSync(directory, { recursive: true }); }
  loadConfig() {
    const path = join(this.directory, 'config.json');
    if (!existsSync(path)) return {};
    try { return JSON.parse(readFileSync(path, 'utf8')); }
    catch { throw new Error('Saved data/config.json is invalid. Fix it or move it aside before starting.'); }
  }
  saveConfig(config) {
    const path = join(this.directory, 'config.json');
    writeFileSync(`${path}.tmp`, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  }
  log(matchId, events) {
    if (!events.length) return;
    const path = join(this.directory, 'events.jsonl');
    // Keep the latest ~10 MB across two files rather than growing without limit.
    if (existsSync(path) && statSync(path).size >= 5 * 1024 * 1024) {
      writeFileSync(join(this.directory, 'events.previous.jsonl'), readFileSync(path));
      writeFileSync(path, '');
    }
    appendFileSync(path, events.map(event => JSON.stringify({ matchId, ...event })).join('\n') + '\n');
  }
}
