/**
 * Azure App Service, as a hosting provider.
 *
 * The link is `.azure/workspace.yml` (resource group and web app name); the web app and its
 * deployment slots come from `az webapp` with the host login or the service principal from
 * plugin.azure.settings.yml; the zip deploy, the log tail and the deployment history go through
 * cmd-tools-azure.sh in a screen session. No database or files pull: neither is reachable generically.
 */

import fs from 'fs';
import path from 'path';
import type { PluginApi, PluginLib } from '@webship/workspace-plugin-api';
import { configured, findCli } from '@webship/workspace-hosting';
import type { EnvInfo, EnvRow, HostingLink, HostingProvider } from '@webship/workspace-hosting';

import { azureLinkOf } from './link';

export function azureProvider(api: PluginApi): HostingProvider {
  const settings = () => api.settings.read() || {};
  const bin = () => findCli('az') || 'az';
  const parts = (link: HostingLink) => { const f = (link as any).fields || {}; return { rg: f.resource_group || String(link.id || '').split('/')[0], app: f.app || String(link.id || '').split('/')[1] }; };

  // Either a service principal for the dashboard, or the host's ~/.azure mounted into the container.
  const jobEnv = (): NodeJS.ProcessEnv | null => {
    const s = settings();
    const base: NodeJS.ProcessEnv = { ...process.env, AZURE_CORE_OUTPUT: 'json', AZURE_CORE_ONLY_SHOW_ERRORS: 'true' };
    const sub = configured(s.subscription);
    if (sub) base.AZURE_SUBSCRIPTION = sub;
    const cid = configured(s.client_id); const sec = configured(s.client_secret); const ten = configured(s.tenant_id);
    if (cid && sec && ten) return { ...base, AZURE_CLIENT_ID: cid, AZURE_CLIENT_SECRET: sec, AZURE_TENANT_ID: ten };
    if (fs.existsSync(path.join(process.env.HOME || '', '.azure', 'azureProfile.json'))) return base;
    return null;
  };

  async function environments(link: HostingLink, lib: PluginLib, env: NodeJS.ProcessEnv): Promise<EnvInfo> {
    const id = link.id as string;
    const { rg, app } = parts(link);
    const sub = env.AZURE_SUBSCRIPTION ? ['--subscription', env.AZURE_SUBSCRIPTION] : [];
    const main = await lib.run(bin(), ['webapp', 'show', '-g', rg, '-n', app, ...sub, '-o', 'json', '--query', '{name:name,state:state,host:defaultHostName}'], process.env.HOME, { timeoutMs: 60 * 1000, env });
    if (!main.ok) return { id, rows: [], why: 'list failed' };
    const rows: EnvRow[] = [];
    try {
      const m = JSON.parse(String(main.stdout));
      rows.push({ title: `${m.name} (production)`, envId: 'production', status: /^running$/i.test(m.state) ? 'active' : String(m.state || 'unknown').toLowerCase(), url: m.host ? `https://${m.host}` : undefined });
    } catch (_) { return { id, rows: [], why: 'list failed' }; }
    const slots = await lib.run(bin(), ['webapp', 'deployment', 'slot', 'list', '-g', rg, '-n', app, ...sub, '-o', 'json', '--query', '[].{name:name,state:state,host:defaultHostName}'], process.env.HOME, { timeoutMs: 60 * 1000, env });
    if (slots.ok) {
      try {
        for (const s of JSON.parse(String(slots.stdout)) as { name: string; state: string; host?: string }[]) {
          rows.push({ title: s.name, envId: s.name, status: /^running$/i.test(s.state) ? 'active' : String(s.state || 'unknown').toLowerCase(), url: s.host ? `https://${s.host}` : undefined });
        }
      } catch (_) { /* no slots */ }
    }
    return { id, rows };
  }

  return {
    id: 'azure',
    label: 'AZURE',
    title: 'Azure',
    cli: 'az',
    script: 'cmd-tools-azure.sh',
    detect: (projectDir) => azureLinkOf(projectDir),
    linkHint: (project) => `bash cmd-tools-azure.sh ${project} --link <resource-group>/<web-app>`,
    consoleUrl: (link) => {
      if (!link.id) return null;
      const { rg, app } = parts(link);
      const sub = configured(settings().subscription);
      return sub ? `https://portal.azure.com/#@/resource/subscriptions/${encodeURIComponent(sub)}/resourceGroups/${encodeURIComponent(rg)}/providers/Microsoft.Web/sites/${encodeURIComponent(app)}` : 'https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Web%2Fsites';
    },
    jobEnv,
    tokenHint: 'the host ~/.azure login, or the service principal in core/config/plugin.azure.settings.yml',
    environments,
    tools: {
      status: { verb: 'azure', label: 'Link and slots', icon: 'info', args: [] },
      activities: { verb: 'azure-activities', label: 'Last 10 deployments', icon: 'list', args: ['--activities'] },
      logs: { verb: 'azure-logs', label: 'Tail the slot logs', icon: 'file-text', args: ['--logs'] },
      deploy: { verb: 'azure-push', label: 'Deploy (zip deploy to the slot)…', icon: 'push', args: ['--push'] },
    },
    errorHint: (msg) => (/AADSTS|Please run 'az login'|not logged in|authentication/i.test(msg)
      ? `${msg}\n\nThe dashboard reaches Azure with the host's ~/.azure login (mounted) or the service principal in core/config/plugin.azure.settings.yml.`
      : msg),
    folder: {
      idPattern: /^[A-Za-z0-9._()-]+\/[A-Za-z0-9-]{2,60}$/,
      idPlaceholder: 'webship-rg/webship-demo',
      idHelp: 'An App Service link is resource-group/web-app-name (az webapp list).',
    },
    menuNote: 'No database or files pull: Azure Database and App Service storage are not reached from here',
  };
}
