#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The project directory in this workspace.')
parser.add_argument('-l', '--link',
                    default="_none_",
                    help='Link the project to an App Service web app: resource-group/app-name (az webapp list).')
parser.add_argument('-p', '--push',
                    action='store_true',
                    default=False,
                    help='Deploy: zip the current code (git archive) and push it to the selected slot (az webapp deploy --type zip). Outward-facing: asks before deploying.')
parser.add_argument('-e', '--environment',
                    default="_none_",
                    help='Slot for THIS run: production, or a deployment slot's name. Default: the one remembered by --select.')
parser.add_argument('-E', '--environments',
                    action='store_true',
                    default=False,
                    help='List the web app and its deployment slots with their state and host name.')
parser.add_argument('-s', '--select',
                    default="_none_",
                    help='Remember which slot this project works against (in .azure/workspace.yml, git-excluded). Checked against the real list.')
parser.add_argument('-g', '--logs',
                    action='store_true',
                    default=False,
                    help='Tail the selected slot's logs (az webapp log tail).')
parser.add_argument('-a', '--activities',
                    action='store_true',
                    default=False,
                    help='List the last 10 deployments of the web app (az webapp log deployment list).')
parser.add_argument('-f', '--force',
                    action='store_true',
                    default=False,
                    help='Allow --link to relink a project that already points at a different web app.')
ARGEOF
