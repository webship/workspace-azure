#!/usr/bin/env bash
## The host side of the Azure plugin: the CLI on this machine and the dashboard's credentials.
## Run by core/scripts/plugins.sh --install azure, and by core/scripts/install.sh for every installed
## plugin that ships one. Idempotent: whatever is already there is reported, not redone. Offered,
## never automatic: a hosting CLI carries cloud credentials for real environments.
set -u
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)}";

# The az CLI on this machine, mounted into the dashboard from ~/.local/bin or found on PATH.
BIN='';
for candidate in "$(command -v az 2>/dev/null)" "${HOME}/.local/bin/az" ; do
  [ -n "${candidate}" ] && [ -x "${candidate}" ] && { BIN="${candidate}"; break; }
done
if [ -n "${BIN}" ] ; then
  printf '  ✓ %-16s %s\n' "az" "${BIN}" ;
else
  printf '  ✗ %-16s %s\n' "az" "missing — the AZURE menu needs it (learn.microsoft.com/cli/azure/install-azure-cli — pipx install azure-cli, or the apt repository)" ;
fi

STATE="$(grep -E '^client_id:' "${WORKSPACE_ROOT}/core/config/plugin.azure.settings.yml" 2>/dev/null | head -1 | sed -E 's/^[a-z_]+:[[:space:]]*//')";
case "${STATE}" in
  ''|CHANGE_ME|"''"|'""') printf '  ✗ %-16s %s\n' "client_id" "not set in plugin.azure.settings.yml — the dashboard cannot reach Azure" ;;
  *)                       printf '  ✓ %-16s %s\n' "client_id" "set (plugin.azure.settings.yml)" ;;
esac

STATE="$(grep -E '^client_secret:' "${WORKSPACE_ROOT}/core/config/plugin.azure.settings.yml" 2>/dev/null | head -1 | sed -E 's/^[a-z_]+:[[:space:]]*//')";
case "${STATE}" in
  ''|CHANGE_ME|"''"|'""') printf '  ✗ %-16s %s\n' "client_secret" "not set in plugin.azure.settings.yml — the dashboard cannot reach Azure" ;;
  *)                       printf '  ✓ %-16s %s\n' "client_secret" "set (plugin.azure.settings.yml)" ;;
esac

