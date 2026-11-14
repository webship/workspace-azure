# @webship.co/workspace-azure

Azure for the [Webship Workspace](https://github.com/webship/workspace) dashboard: the **AZURE**
menu on every site row, a live-site chip on the project card, "Link to Azure" when a new folder is
made, and the `cmd-tools-azure.sh` command in every site workspace. A provider of
[`@webship.co/workspace-hosting`](https://github.com/webship/workspace-hosting), which draws the menu,
the environments modal, the get-database-and-files flow and the New-folder section for every host.

App Service is the Azure product with environments the way the family understands them: a web app (production) and its deployment slots, each with a host name and a state. A deploy is a zip deploy of the current code to the chosen slot; the logs are `az webapp log tail`; the history is the deployment list. Azure Database for MySQL is not reachable generically from a laptop and App Service has no files mount of its own, so there is no `--pull-db` or `--pull-files`.

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require github:webship/workspace-azure
bash core/scripts/plugins.sh --activate azure
bash core/scripts/plugins.sh --install azure
bash core/scripts/plugins.sh --configure azure      # core/config/plugin.azure.settings.yml
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page.

## What it needs

A workspace starts empty, so the manifest says what else this plugin needs (`needs`):

- one sites folder: `dev`, `test`, `demos`, `sandboxes`, `projects` (`dev` is the one added when none is there). `cmd-tools-azure.sh`, which the menu's verbs run, is placed in it, and the menu is on its project rows.
- on the machine: `az`, the provider's CLI (https://learn.microsoft.com/cli/azure/install-azure-cli).

`--require` says so, `--activate` and `--install` stop until the workspace has a sites folder, and `--with-needs` adds it first. A missing command is said and never added:

```bash
bash core/scripts/plugins.sh --activate azure --with-needs
bash core/scripts/plugins.sh --check azure      # each command: found, with its version, or missing, with how to install it
```

A workspace that knows none of this (Webship Workspace 1.0.8 and older) ignores the keys: add a sites folder yourself, then `--install azure` again.

## The command

```bash
cd ~/workspace/dev
bash cmd-tools-azure.sh <project> [verb]
```

| Verb | What it does |
| --- | --- |
| `--link` <value> | Link the project to an App Service web app: resource-group/app-name (az webapp list). |
| `--push` | Deploy: zip the current code (git archive) and push it to the selected slot (az webapp deploy --type zip). Outward-facing: asks before deploying. |
| `--environment` <value> | Slot for THIS run: production, or a deployment slot's name. Default: the one remembered by --select. |
| `--environments` | List the web app and its deployment slots with their state and host name. |
| `--select` <value> | Remember which slot this project works against (in .azure/workspace.yml, git-excluded). Checked against the real list. |
| `--logs` | Tail the selected slot's logs (az webapp log tail). |
| `--activities` | List the last 10 deployments of the web app (az webapp log deployment list). |
| `--force` | Allow --link to relink a project that already points at a different web app. |

The link lives in the project's `.azure/workspace.yml` (git-excluded); the dashboard reads it to know
the project is linked and which environment it works against.

## What the package holds

| Path | What it is |
| --- | --- |
| `src/index.ts` | `register(api)`: `registerHosting(api, azureProvider(api))` |
| `src/lib/provider.ts` | The Azure provider: the credentials, the environments and their URLs, the verbs, the pulls, the console |
| `src/lib/link.ts` | The link file reader |
| `commands/cmd-tools-azure.sh` | The per-workspace command |
| `scripts/functions/fun-azure.sh` | The provider's bash hooks (az) |
| `scripts/functions/fun-azure-tool.sh` | The family's dispatcher: link file, environment selection, safety export, status |
| `scripts/args/arg-azure.sh` | Its argparse |
| `scripts/host-install.sh` | The host side: the CLI and the credential check |
| `config/plugin.azure.settings.yml` | The settings template |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.
