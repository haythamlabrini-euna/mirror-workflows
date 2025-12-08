#!/bin/bash
# Helper script to construct Bitbucket pipeline URL
# Usage: setup-pipeline-url.sh <workspace> <repo_slug> <uuid>
#
# This script constructs the Bitbucket pipeline URL from the provided
# workspace, repository slug, and pipeline UUID.

set -euo pipefail

# Validate inputs
if [ $# -ne 3 ]; then
  echo "Error: Expected 3 arguments (workspace, repo_slug, uuid)" >&2
  exit 1
fi

WORKSPACE="$1"
REPO_SLUG="$2"
UUID="$3"

# Remove curly braces from UUID if present
CLEAN_UUID=$(echo "${UUID}" | tr -d '{}')

# Construct the Bitbucket pipeline URL
# Format: https://bitbucket.org/{workspace}/{repo_slug}/addon/pipelines/home#!/results/{uuid}
PIPELINE_URL="https://bitbucket.org/${WORKSPACE}/${REPO_SLUG}/addon/pipelines/home#!/results/{${CLEAN_UUID}}"

# Output the URL (can be captured with command substitution)
echo "${PIPELINE_URL}"
