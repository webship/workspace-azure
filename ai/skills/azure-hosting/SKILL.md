---
name: azure-hosting
description: Work with a Webship Workspace site on Azure through the Azure plugin (`@webship.co/workspace-azure`) — the AZURE menu of a project row and the command behind every entry, `cmd-tools-azure.sh`, with each of its options, how a project is linked, the keys of `plugin.azure.settings.yml` and the credential they hold, and what the command says when something is missing. Use when asked "is this site linked to Azure", "link this project", "list the environments", "what was deployed last", "deploy this site", "the menu says not linked", or "where does the Azure token go".
argument-hint: '<project>'
---

# azure-hosting

Azure for a site of a Webship Workspace (`~/workspace`, container-based, DDEV by default). It comes
with the Azure plugin (`@webship.co/workspace-azure`), a provider of the hosting family (`@webship.co/workspace-hosting`),
like the agent `azure-deployer`, the command `/azure-status` and the prompt `azure-test-then-deploy`.

## The AZURE menu

The AZURE menu is on the project rows of the sites folders. The caption beside it says `linked`
or `not linked`. A project that is not linked is shown how to link it; a linked one gets these
entries, and each of them runs the command of the plugin in a terminal session, from the sites
folder:

| Menu entry | The command |
| --- | --- |
| **Link and slots** | `bash cmd-tools-azure.sh <project>` |
| **Last 10 deployments** | `bash cmd-tools-azure.sh <project> --activities` |
| **Tail the slot logs** | `bash cmd-tools-azure.sh <project> --logs` |
| **Deploy (zip deploy to the slot)…** | `bash cmd-tools-azure.sh <project> --push` |

The menu ends with the note "No database or files pull: Azure Database and App Service storage are not reached from here".

## The command

`cmd-tools-azure.sh` is placed in every sites folder of the workspace. The first word after it is the
project; with nothing else it says whether the project is linked, and to what.

```bash
cd ~/workspace/<folder>
bash cmd-tools-azure.sh <project>
bash cmd-tools-azure.sh <project> --link <resource-group>/<web-app>
bash cmd-tools-azure.sh <project> --environments
```

| Option | What it does |
| --- | --- |
| `--link <value>` | Link the project to an App Service web app: resource-group/app-name (az webapp list). |
| `--push` | Deploy: zip the current code (git archive) and push it to the selected slot (az webapp deploy --type zip). Outward-facing: asks before deploying. |
| `--environment <value>` | Slot for THIS run: production, or a deployment slot's name. Default: the one remembered by --select. |
| `--environments` | List the web app and its deployment slots with their state and host name. |
| `--select <value>` | Remember which slot this project works against (in .azure/workspace.yml, git-excluded). Checked against the real list. |
| `--logs` | Tail the selected slot's logs (az webapp log tail). |
| `--activities` | List the last 10 deployments of the web app (az webapp log deployment list). |
| `--force` | Allow --link to relink a project that already points at a different web app. |

With no project the command says that `PROJECT_NAME` is required; with a project that is not in
the folder, "No such project"; with an option that needs a link on a project that has none, "Not
linked to Azure".

## Link a project

A project is linked to an App Service web app as `resource-group/app-name`. The link is written to `.azure/workspace.yml` in the project, which git does not track. An App Service link is resource-group/web-app-name (az webapp list).

```bash
bash cmd-tools-azure.sh <project> --link <resource-group>/<web-app>
```

## The settings: `core/config/plugin.azure.settings.yml`

| Key | What it is |
| --- | --- |
| `subscription:` | The subscription id or name the web apps live in (az account list). |
| `tenant_id:` | The Entra tenant of the service principal (optional when the host login is mounted). |
| `client_id:` | An app registration with Contributor on the resource groups (optional when the host login is mounted). Read as AZURE_CLIENT_ID. |
| `client_secret:` | Its secret. Read as AZURE_CLIENT_SECRET. |

The dashboard reaches Azure with the host ~/.azure login, or the service principal in core/config/plugin.azure.settings.yml. The file is created mode 600 and its secrets are
masked on the Settings page. Never print them, never copy them into another file, and never commit
the file.

## Turn it on, and check it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require @webship.co/workspace-azure
bash core/scripts/plugins.sh --activate azure --with-needs     # adds a sites folder and the AI folders when they are missing
bash core/scripts/plugins.sh --install azure
bash core/scripts/plugins.sh --configure azure
bash core/scripts/plugins.sh --check azure                     # the commands it needs on the machine
```

## Traps

- **"Please run 'az login'" or an AADSTS error**: the dashboard reaches Azure with the login of the machine's `~/.azure`, or with the service principal in `tenant_id:`, `client_id:` and `client_secret:`.
- **No database pull and no files pull**: Azure Database and the storage of App Service are not reached from here, and the command has neither option.
- **An environment here is a slot**: `production`, or the name of a deployment slot.
- **The log entry follows**: it runs `az webapp log tail`, which goes on until it is interrupted. It is for a terminal.
- **A deploy is a zip deploy**: the current code is zipped with `git archive` and pushed to the selected slot (`az webapp deploy --type zip`). What is not committed is not in it. It asks before it deploys.
- **A deploy is outward-facing.** The command asks before it sends anything, in a terminal: it is
  not a step for an AI assistant to take on its own.

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
