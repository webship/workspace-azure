/**
 * Whether a project is linked to Azure, and to what: the `.azure/workspace.yml` file that
 * `cmd-tools-azure.sh --link` writes (git-excluded), plus the branch the local code is on.
 */

import fs from 'fs';
import path from 'path';
import type { HostingLink } from '@webship/workspace-hosting';

export interface AzureLink extends HostingLink {
  /** Every key of the link file, for the provider's own needs (region, resource group, host…). */
  fields: Record<string, string>;
}

export function readLinkFile(projectDir: string): Record<string, string> | null {
  let text: string;
  try { text = fs.readFileSync(path.join(projectDir, '.azure', 'workspace.yml'), 'utf8'); } catch (_) { return null; }
  const fields: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (m) fields[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return fields;
}

export function azureLinkOf(projectDir: string): AzureLink | null {
  const fields = readLinkFile(projectDir);
  if (!fields || !fields.id) return null;
  let branch: string | null = null;
  try {
    const head = fs.readFileSync(path.join(projectDir, '.git', 'HEAD'), 'utf8').trim();
    branch = (head.match(/^ref: refs\/heads\/(.+)$/) || [])[1] || null;
  } catch (_) { /* not a git clone */ }
  return { id: fields.id, env: fields.env || null, branch, fields };
}
