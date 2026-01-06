#!/bin/bash
# Test TypeScript actions locally without running GitHub Actions
#
# This script allows you to test the TypeScript actions in isolation.
# It simulates the environment variables that GitHub Actions would set.
#
# Prerequisites:
#   - Node.js 20+
#   - pnpm install (to build the actions)
#   - A valid Bitbucket API token
#
# Usage:
#   export BITBUCKET_API_TOKEN="your-token"
#   export BITBUCKET_REPO="workspace/repo-slug"
#   ./examples/test-actions-locally.sh [test-name]
#
# Available tests:
#   trigger   - Test the trigger-custom-pipeline action
#   wait      - Test the wait-for-bitbucket-pipeline-by-uuid action (requires a UUID)
#   all       - Run all tests in sequence

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check required environment variables
check_env() {
  if [ -z "$BITBUCKET_API_TOKEN" ]; then
    echo -e "${RED}Error: BITBUCKET_API_TOKEN is not set${NC}"
    echo "Export it before running: export BITBUCKET_API_TOKEN=your-token"
    exit 1
  fi
  
  if [ -z "$BITBUCKET_REPO" ]; then
    echo -e "${RED}Error: BITBUCKET_REPO is not set${NC}"
    echo "Export it before running: export BITBUCKET_REPO=workspace/repo-slug"
    exit 1
  fi
}

# Build actions if not already built
build_actions() {
  if [ ! -f "$ROOT_DIR/.github/actions/trigger-custom-pipeline/dist/index.js" ]; then
    echo -e "${YELLOW}Building actions...${NC}"
    cd "$ROOT_DIR"
    pnpm install
    pnpm build
    cd -
  fi
}

# Test: trigger-custom-pipeline action
test_trigger() {
  echo -e "${GREEN}=== Testing trigger-custom-pipeline action ===${NC}"
  
  # Create a temporary file for outputs (simulating GITHUB_OUTPUT)
  export GITHUB_OUTPUT=$(mktemp)
  
  # Set action inputs via environment variables
  export PIPELINE_NAME="${PIPELINE_NAME:-contract-test}"
  export BRANCH_NAME="${BRANCH_NAME:-main}"
  
  echo "Triggering pipeline: $PIPELINE_NAME on branch: $BRANCH_NAME"
  echo "Repository: $BITBUCKET_REPO"
  
  # Run the action
  node "$ROOT_DIR/.github/actions/trigger-custom-pipeline/dist/index.js"
  
  # Show outputs
  echo -e "\n${GREEN}Outputs:${NC}"
  cat "$GITHUB_OUTPUT"
  
  # Extract UUID for use in wait test
  TRIGGERED_UUID=$(grep "triggered_pipeline_uuid=" "$GITHUB_OUTPUT" | cut -d'=' -f2)
  export TRIGGERED_UUID
  
  rm "$GITHUB_OUTPUT"
  unset GITHUB_OUTPUT
  
  echo -e "\n${GREEN}Trigger test completed!${NC}"
  echo "To test waiting, run: PIPELINE_UUID=$TRIGGERED_UUID ./examples/test-actions-locally.sh wait"
}

# Test: wait-for-bitbucket-pipeline-by-uuid action
test_wait() {
  echo -e "${GREEN}=== Testing wait-for-bitbucket-pipeline-by-uuid action ===${NC}"
  
  if [ -z "$PIPELINE_UUID" ]; then
    echo -e "${RED}Error: PIPELINE_UUID is not set${NC}"
    echo "Either run 'test_trigger' first, or export PIPELINE_UUID=your-uuid"
    exit 1
  fi
  
  # Create a temporary file for outputs
  export GITHUB_OUTPUT=$(mktemp)
  
  # Set action inputs - use shorter intervals for testing
  export POLL_INTERVAL="${POLL_INTERVAL:-30}"
  export MAX_ATTEMPTS="${MAX_ATTEMPTS:-10}"
  
  echo "Waiting for pipeline UUID: $PIPELINE_UUID"
  echo "Poll interval: ${POLL_INTERVAL}s, Max attempts: $MAX_ATTEMPTS"
  
  # Run the action
  node "$ROOT_DIR/.github/actions/wait-for-bitbucket-pipeline-by-uuid/dist/index.js" || true
  
  # Show outputs
  echo -e "\n${GREEN}Outputs:${NC}"
  cat "$GITHUB_OUTPUT"
  
  rm "$GITHUB_OUTPUT"
  unset GITHUB_OUTPUT
  
  echo -e "\n${GREEN}Wait test completed!${NC}"
}

# Run all tests
test_all() {
  test_trigger
  
  if [ -n "$TRIGGERED_UUID" ]; then
    echo -e "\n${YELLOW}Waiting 10 seconds before checking pipeline status...${NC}"
    sleep 10
    
    export PIPELINE_UUID="$TRIGGERED_UUID"
    test_wait
  fi
}

# Main
check_env
build_actions

case "${1:-all}" in
  trigger)
    test_trigger
    ;;
  wait)
    test_wait
    ;;
  all)
    test_all
    ;;
  *)
    echo "Usage: $0 [trigger|wait|all]"
    exit 1
    ;;
esac

