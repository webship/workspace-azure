/**
 * The status of a linked project for someone without az, without its login, or without an answer:
 * `cmd-tools-azure.sh <project>`, the menu's status verb. It shows the link, says once what is missing
 * and how to fix it, never prints an empty list, a Python traceback or "command not found", and fails.
 *
 * The hooks run here as the command runs them, in a temp workspace whose PATH holds only the basic
 * tools and the stand-ins a test gives: no az, whatever this machine has. Nothing leaves it.
 */
import test, { after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const HOOKS = ['scripts/functions/fun-azure.sh', 'scripts/functions/fun-azure-tool.sh'].map((f) => path.join(PKG, f));

/** This machine's own copy of a tool, from its PATH. */
function which(tool: string): string | null {
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    const f = path.join(dir, tool);
    try { if (fs.statSync(f).isFile()) { fs.accessSync(f, fs.constants.X_OK); return f; } } catch (_) { /* not here */ }
  }
  return null;
}
const BASIC = ['bash', 'python3', 'grep', 'sed', 'head', 'tail', 'awk', 'tr', 'cat', 'dirname', 'mkdir', 'touch', 'date', 'mktemp', 'find'];
const skip = ['bash', 'python3', 'grep', 'sed', 'head', 'awk'].every((t) => which(t)) ? false : 'bash, python3, grep, sed, head or awk is not here';

const temps: string[] = [];
after(() => { for (const d of temps) fs.rmSync(d, { recursive: true, force: true }); });

/** A workspace: core/config with the settings template, dev/site1 (linked unless told otherwise), bin/ with the basic tools and the stand-ins. */
function workspace(standIns: Record<string, string> = {}, linked = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-status-'));
  temps.push(root);
  const bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(root, 'core', 'config'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dev', 'site1'), { recursive: true });
  fs.mkdirSync(path.join(root, 'home'));
  fs.mkdirSync(bin);
  fs.copyFileSync(path.join(PKG, 'config', 'plugin.azure.settings.yml'), path.join(root, 'core', 'config', 'plugin.azure.settings.yml'));
  if (linked) {
    fs.mkdirSync(path.join(root, 'dev', 'site1', '.azure'));
    fs.writeFileSync(path.join(root, 'dev', 'site1', '.azure', 'workspace.yml'), 'id: site1-rg/site1-app\nresource_group: site1-rg\napp: site1-app\n');
  }
  for (const t of BASIC) { const real = which(t); if (real) fs.symlinkSync(real, path.join(bin, t)); }
  for (const [name, body] of Object.entries(standIns)) fs.writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
  return root;
}

/** What `bash cmd-tools-azure.sh site1 [flags]` does once the workspace has loaded: the dispatcher, with the flags argparse would set. */
function run(root: string, flags: Record<string, string> = {}) {
  const r = spawnSync(which('bash') as string, ['-c', `source "${HOOKS[0]}" && source "${HOOKS[1]}" && azure_project_tool`], {
    cwd: path.join(root, 'dev'), input: '', encoding: 'utf8',
    env: { PATH: path.join(root, 'bin'), HOME: path.join(root, 'home'), WORKSPACE_ROOT: root, WORKSPACE_CONFIG: path.join(root, 'core', 'config'), doc_name: 'dev', PROJECT_NAME: 'site1', ...flags },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const times = (s: string, needle: string) => s.split(needle).length - 1;

function clean(out: string) {
  assert.doesNotMatch(out, /Traceback|JSONDecodeError/, `no Python traceback:\n${out}`);
  assert.doesNotMatch(out, /command not found|No such file or directory/, `no shell error:\n${out}`);
}

/** The part of the status known on this machine: the link and the console, with something said between them. */
function local(out: string) {
  assert.match(out, /linked:\s+site1-rg\/site1-app/, 'the link still shows');
  assert.ok(out.includes('Console: https://portal.azure.com/ → App Services → site1-app'), 'the console still shows');
  assert.doesNotMatch(out, /env:[^\n]*\n\n\n\s+Console:/, 'no empty block between the link and the console');
}

test('without az, the status of a linked project shows the link, says once how to install az, and fails', { skip }, () => {
  const { status, out } = run(workspace());
  clean(out);
  local(out);
  assert.strictEqual(times(out, 'The az CLI is not installed'), 1, out);
  assert.notStrictEqual(status, 0, 'the provider could not be reached');
});

test('with az but no login, the status says how to log in, and fails', { skip }, () => {
  const { status, out } = run(workspace({ az: 'echo "ERROR: Please run az login to setup account." >&2; exit 1' }));
  clean(out);
  local(out);
  assert.strictEqual(times(out, 'az is installed but not logged in'), 1, out);
  assert.notStrictEqual(status, 0);
});

test('with a login but no web app in the answer, the status says so instead of an empty list, and fails', { skip }, () => {
  const { status, out } = run(workspace({ az: 'case "$1 $2" in "account show") exit 0 ;; *) echo "ERROR: (ResourceNotFound)" >&2; exit 3 ;; esac' }));
  clean(out);
  local(out);
  assert.match(out, /\(could not read the web app — check az account show\)/);
  assert.notStrictEqual(status, 0);
});

test('--activities with no answer says so without a traceback', { skip }, () => {
  const { out } = run(workspace({ az: 'case "$1 $2" in "account show") exit 0 ;; *) echo "not JSON"; exit 3 ;; esac' }), { ACTIVITIES: 'yes' });
  clean(out);
  assert.match(out, /\(could not list the deployments\)/);
});

test('with az and a login, production and the slots are listed and the run succeeds', { skip }, () => {
  const az = `case "$1 $2 $3" in
  "account show"*) exit 0 ;;
  "webapp show"*) printf 'site1-app\\tRunning\\tsite1-app.example.invalid\\n' ;;
  "webapp deployment slot") printf 'staging\\tRunning\\tsite1-app-staging.example.invalid\\n' ;;
  *) exit 3 ;;
esac`;
  const { status, out } = run(workspace({ az }));
  clean(out);
  local(out);
  assert.match(out, /production\s+running\s+https:\/\/site1-app\.example\.invalid/);
  assert.match(out, /staging\s+running\s+https:\/\/site1-app-staging\.example\.invalid/);
  assert.strictEqual(status, 0, out);
});

test('a project that is not linked shows how to link it, needs no az, and succeeds', { skip }, () => {
  const { status, out } = run(workspace({}, false));
  clean(out);
  assert.match(out, /not linked\. Link it with:/);
  assert.doesNotMatch(out, /not installed/);
  assert.strictEqual(status, 0, out);
});
