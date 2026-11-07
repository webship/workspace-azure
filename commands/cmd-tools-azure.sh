#!/usr/bin/env bash

# Installed by the Azure plugin (plugins.sh --install azure); __WORKSPACE__ is the workspace it was installed into.
#
# The local ⇄ cloud bridge for one project on Azure: show its link and environments, link it,
# bring a database and files down into DDEV, deploy, read logs.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings and extra lists.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

ARGPARSE_DESCRIPTION="Show, link, pull from or deploy a __WORKSPACE__ project on Azure"
# The args file comes with the plugin: core/scripts/plugins/azure/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/azure/args/arg-azure.sh || exit 1 ;

shift $#;

azure_project_tool ;
