#!/usr/bin/env bash

# Azure App Service through the az CLI. The hooks the hosting dispatcher (fun-azure-tool.sh) calls
# for one project directory. Everything defaults to read-only; --link and --push each demand their
# flag, and nothing here ever creates or deletes a web app or a slot.

function azure_rg() { azure_link_get "$1" resource_group ; }
function azure_app() { azure_link_get "$1" app ; }
function azure_sub() { [ -n "${AZURE_SUBSCRIPTION:-${subscription:-}}" ] && [ ! "${AZURE_SUBSCRIPTION:-${subscription:-}}" == 'CHANGE_ME' ] && printf -- '--subscription %s' "${AZURE_SUBSCRIPTION:-${subscription}}" ; }

function ensure_azure() {
  if command -v az > /dev/null 2>&1 ; then
    if ! az account show > /dev/null 2>&1 ; then
      if [ -n "${AZURE_CLIENT_ID:-}" ] && [ -n "${AZURE_CLIENT_SECRET:-}" ] && [ -n "${AZURE_TENANT_ID:-}" ] ; then
        az login --service-principal -u "${AZURE_CLIENT_ID}" -p "${AZURE_CLIENT_SECRET}" --tenant "${AZURE_TENANT_ID}" > /dev/null || return 1 ;
      else
        echo "az is installed but not logged in. On the host: az login; in the dashboard: the service principal in the plugin settings." ;
        return 1 ;
      fi
    fi
    return 0 ;
  fi
  echo "The az CLI is not installed. Install it first: https://learn.microsoft.com/cli/azure/install-azure-cli (pipx install azure-cli)" ;
  return 1 ;
}

function azure_do_link() {
  local project_path="$1" spec="$2" rg app;
  [[ "${spec}" =~ ^([^/]+)/([^/]+)$ ]] || { echo "An App Service link is resource-group/web-app-name, got: ${spec}"; return 1; } ;
  rg="${BASH_REMATCH[1]}"; app="${BASH_REMATCH[2]}";
  # shellcheck disable=SC2046
  az webapp show -g "${rg}" -n "${app}" $(azure_sub) -o none 2>/dev/null || { echo "No web app ${app} in resource group ${rg} (az webapp list)."; return 1; } ;
  azure_link_set "${project_path}" id "${rg}/${app}" ;
  azure_link_set "${project_path}" resource_group "${rg}" ;
  azure_link_set "${project_path}" app "${app}" ;
}

function azure_list_environments() {
  echo production ;
  # shellcheck disable=SC2046
  az webapp deployment slot list -g "$(azure_rg "$1")" -n "$(azure_app "$1")" $(azure_sub) -o tsv --query '[].name' 2>/dev/null ;
}

function azure_do_environments() {
  local project_path="$1";
  # shellcheck disable=SC2046
  az webapp show -g "$(azure_rg "${project_path}")" -n "$(azure_app "${project_path}")" $(azure_sub) -o tsv --query '[name, state, defaultHostName]' 2>/dev/null \
    | awk '{ printf "  %-24s %-10s https://%s\n", "production", tolower($2), $3 }' || { echo "  (could not read the web app — check az account show)"; return 1; } ;
  # shellcheck disable=SC2046
  az webapp deployment slot list -g "$(azure_rg "${project_path}")" -n "$(azure_app "${project_path}")" $(azure_sub) -o tsv --query '[].[name, state, defaultHostName]' 2>/dev/null \
    | awk '{ printf "  %-24s %-10s https://%s\n", $1, tolower($2), $3 }' ;
}

function azure_slot_arg() { [ -n "$1" ] && [ ! "$1" == 'production' ] && printf -- '--slot %s' "$1" ; }

function azure_pull_db() { echo "Azure Database is not reached from here: there is no --pull-db."; return 1 ; }
function azure_pull_files() { echo "App Service has no files mount this tool syncs: there is no --pull-files."; return 1 ; }

function azure_do_push() {
  local project_path="$1" id="$2" env="$3" zip a;
  echo "Deploy ${doc_name}/${PROJECT_NAME} → ${id} (${env})";
  echo "  git archive HEAD → zip → az webapp deploy --type zip. The live slot changes.";
  read -r -p "  Continue? [y/N] " a < /dev/tty || return 1 ;
  [[ "${a}" =~ ^[Yy] ]] || { echo "Not deployed."; return 1; } ;
  zip="$(mktemp -d)/${PROJECT_NAME}.zip";
  (cd "${project_path}" && git archive --format=zip -o "${zip}" HEAD) || { echo "git archive failed — the deploy ships the committed tree."; return 1; } ;
  # shellcheck disable=SC2046
  az webapp deploy -g "$(azure_rg "${project_path}")" -n "$(azure_app "${project_path}")" $(azure_slot_arg "${env}") $(azure_sub) --type zip --src-path "${zip}" || return 1 ;
  echo "  Deployed to ${env}.";
}

function azure_do_logs() {
  local project_path="$1" id="$2" env="$3";
  # shellcheck disable=SC2046
  az webapp log tail -g "$(azure_rg "${project_path}")" -n "$(azure_app "${project_path}")" $(azure_slot_arg "${env}") $(azure_sub) ;
}

function azure_do_activities() {
  local project_path="$1";
  # shellcheck disable=SC2046
  az webapp log deployment list -g "$(azure_rg "${project_path}")" -n "$(azure_app "${project_path}")" $(azure_sub) -o json 2>/dev/null | python3 -c 'import json,sys
for d in json.load(sys.stdin)[:10]:
    print("  %-20s %-10s %s" % ((d.get("received_time") or d.get("start_time") or "")[:19], "ok" if d.get("complete") else "running", (d.get("message") or d.get("id") or "")[:60]))' \
    || echo "  (could not list the deployments)" ;
}

function azure_status() {
  local project_path="$1" id="$2";
  if [ -z "${id}" ] ; then
    echo "    (the link is resource-group/web-app-name; az webapp list)";
    return 0 ;
  fi
  echo "";
  azure_do_environments "${project_path}" ;
  echo "";
  echo "  Console: https://portal.azure.com/ → App Services → $(azure_app "${project_path}")";
  echo "  --push zip-deploys the committed tree to the selected slot; --logs tails it.";
}
