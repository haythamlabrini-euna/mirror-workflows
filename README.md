# Mirror Workflows

Reusable GitHub Actions and workflows for mirroring repositories to Bitbucket.

## Features

- **Mirror branches** from GitHub to Bitbucket
- **Delete branches** on Bitbucket when PRs are closed
- **Wait for Bitbucket pipelines** to complete and report status
- **Trigger pipelines** via API when commits already exist

## Reusable Workflows

This repository provides two purpose-specific reusable workflows:

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `reusable-mirror-branch.yml` | Mirror a branch to Bitbucket | Push events, PR opened/synchronized |
| `reusable-delete-branch.yml` | Delete a branch from Bitbucket | PR closed (merged or not) |

## Quick Start

### Recommended: Use Split Workflows

The simplest way to use this from another repository:

```yaml
# .github/workflows/mirror.yml
name: Mirror to Bitbucket

on:
  # Mirror default branch (main/master) when commits are pushed
  push:
    branches: [main, master]
  # Handle PR events: mirror PR branch, cleanup on close/merge
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main, master]

jobs:
  # Job 1: Mirror branch on push or PR open/sync
  mirror:
    if: github.event_name == 'push' || github.event.action != 'closed'
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-mirror-branch.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref || github.ref_name }}
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_REPO: ${{ secrets.BITBUCKET_REPO }}
      BITBUCKET_USER_EMAIL: ${{ secrets.BITBUCKET_USER_EMAIL }}

  # Job 2: Delete PR branch on close (merged or not)
  cleanup:
    if: github.event.action == 'closed'
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-delete-branch.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref }}
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_REPO: ${{ secrets.BITBUCKET_REPO }}
```

**How it works:**

| GitHub Event | Workflow Called | Result on Bitbucket |
|--------------|-----------------|---------------------|
| Push to main/master | `reusable-mirror-branch.yml` | Mirrors default branch |
| PR opened/synchronized | `reusable-mirror-branch.yml` | Mirrors PR branch |
| PR closed (not merged) | `reusable-delete-branch.yml` | Deletes PR branch |
| PR merged | `reusable-delete-branch.yml` | Deletes PR branch (main mirrored via push event) |

### Option 2: Use Composite Actions Directly

For more control, use the individual actions:

```yaml
# .github/workflows/mirror.yml
name: Mirror to Bitbucket

on:
  push:
    branches: [main]

jobs:
  mirror:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Mirror to Bitbucket
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/mirror-to-bitbucket@main
        with:
          bitbucket_username: ${{ secrets.BITBUCKET_USERNAME }}
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
          bitbucket_user_email: ${{ secrets.BITBUCKET_USER_EMAIL }}
          branch_name: ${{ github.ref_name }}

      - name: Wait for Bitbucket Pipeline
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/wait-for-bitbucket-pipeline@main
        with:
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
```

## Required Secrets

Set these secrets in your repository:

| Secret | Description |
|--------|-------------|
| `BITBUCKET_USERNAME` | Bitbucket username or `x-token-auth` for app passwords |
| `BITBUCKET_API_TOKEN` | Bitbucket API token or app password with repository write access |
| `BITBUCKET_REPO` | Bitbucket repository in `workspace/repo-slug` format |
| `BITBUCKET_USER_EMAIL` | Email address for git commits |

## Reusable Workflow Reference

### `reusable-mirror-branch.yml`

Mirrors a branch from GitHub to Bitbucket, optionally waits for pipeline.

**Inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `branch_name` | Yes | - | Branch name to mirror |
| `wait_for_pipeline` | No | `true` | Wait for Bitbucket pipeline to complete |
| `poll_interval` | No | `30` | Seconds between pipeline status checks |
| `max_attempts` | No | `60` | Max polling attempts before timeout |

**Outputs:**

| Output | Description |
|--------|-------------|
| `branch_pushed` | The branch name that was pushed |
| `push_occurred` | Whether a push actually occurred |
| `pipeline_result` | Final result of the Bitbucket pipeline |
| `pipeline_url` | URL to view the pipeline in Bitbucket |

### `reusable-delete-branch.yml`

Deletes a branch from Bitbucket (for PR cleanup).

**Inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `branch_name` | Yes | - | Branch name to delete |
| `allow_deletion` | No | `true` | If false, skip deletion |

**Outputs:**

| Output | Description |
|--------|-------------|
| `branch_deleted` | Whether the branch was actually deleted |

## Actions Reference

### `mirror-to-bitbucket`

Mirrors a branch to Bitbucket.

```yaml
- uses: haythamlabrini-euna/mirror-workflows/.github/actions/mirror-to-bitbucket@main
  with:
    bitbucket_username: ${{ secrets.BITBUCKET_USERNAME }}
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
    bitbucket_user_email: ${{ secrets.BITBUCKET_USER_EMAIL }}
    branch_name: main
    action_type: push          # 'push' or 'delete'
    force_trigger: false       # Force push even if commit exists
    allow_branch_deletion: true
```

**Outputs:**
- `branch_pushed`: Branch name that was pushed
- `push_occurred`: Whether push occurred (`true`/`false`)
- `triggered_pipeline_uuid`: UUID of triggered pipeline
- `pipelines_configured`: Whether `bitbucket-pipelines.yml` exists

### `wait-for-bitbucket-pipeline`

Polls Bitbucket API to wait for a pipeline to complete.

```yaml
- uses: haythamlabrini-euna/mirror-workflows/.github/actions/wait-for-bitbucket-pipeline@main
  with:
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
    commit_sha: ${{ github.sha }}     # Optional, defaults to HEAD
    poll_interval: 30                  # Seconds between checks
    max_attempts: 60                   # Max attempts before timeout
    expected_pipeline_uuid: ''         # Optional, specific pipeline to track
```

**Outputs:**
- `pipeline_uuid`: UUID of the pipeline
- `pipeline_state`: Final state (e.g., `COMPLETED`)
- `pipeline_result`: Final result (e.g., `SUCCESSFUL`, `FAILED`)
- `pipeline_url`: URL to view the pipeline
- `error_message`: Error details if pipeline failed

## Repository Setup

### For Private Repositories

If this repository is private, you need to grant access to calling repositories:

1. Go to **Settings** → **Actions** → **General**
2. Under "Access", select **"Accessible from repositories in the organization"**
3. Or for specific repos: **"Accessible from repositories owned by the user"**

### Building the Actions

The TypeScript actions need to be compiled before use:

```bash
# Install dependencies
pnpm install

# Build the actions
pnpm build
```

This creates the `dist/` folders needed by the composite actions.

## Complete Example: PR Mirroring Workflow

### Using Split Reusable Workflows (Recommended)

This example handles all PR scenarios using the split workflows:

```yaml
# .github/workflows/mirror.yml
name: Mirror to Bitbucket

on:
  # Mirror default branch when commits are pushed (including merge commits)
  push:
    branches: [main, master]
  # Handle PR lifecycle events
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main, master]

jobs:
  # Mirror branch on push events or PR open/sync
  mirror:
    if: github.event_name == 'push' || github.event.action != 'closed'
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-mirror-branch.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref || github.ref_name }}
      wait_for_pipeline: true
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_REPO: ${{ secrets.BITBUCKET_REPO }}
      BITBUCKET_USER_EMAIL: ${{ secrets.BITBUCKET_USER_EMAIL }}

  # Delete PR branch on close (merged or not)
  cleanup:
    if: github.event.action == 'closed'
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-delete-branch.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref }}
      allow_deletion: true
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_REPO: ${{ secrets.BITBUCKET_REPO }}
```

**Event Flow:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PR LIFECYCLE EVENTS                               │
├─────────────────────────┬───────────────────────────────────────────────────┤
│ PR opened/synchronized  │ → reusable-mirror-branch.yml → Mirror PR branch  │
├─────────────────────────┼───────────────────────────────────────────────────┤
│ PR closed (not merged)  │ → reusable-delete-branch.yml → Delete PR branch  │
├─────────────────────────┼───────────────────────────────────────────────────┤
│ PR merged               │ → reusable-delete-branch.yml → Delete PR branch  │
│                         │ → (push event) → Mirror main/master              │
└─────────────────────────┴───────────────────────────────────────────────────┘
```

### Using Composite Actions Directly

For more control, use the individual actions:

```yaml
# .github/workflows/mirror-pr.yml
name: Mirror PRs to Bitbucket

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]
    branches: [main, master]

jobs:
  mirror:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          fetch-depth: 0

      - name: Mirror branch
        id: mirror
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/mirror-to-bitbucket@main
        with:
          bitbucket_username: ${{ secrets.BITBUCKET_USERNAME }}
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
          bitbucket_user_email: ${{ secrets.BITBUCKET_USER_EMAIL }}
          branch_name: ${{ github.event.pull_request.head.ref }}
          action_type: push

      - name: Wait for pipeline
        if: steps.mirror.outputs.pipelines_configured == 'true'
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/wait-for-bitbucket-pipeline@main
        with:
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
          expected_pipeline_uuid: ${{ steps.mirror.outputs.triggered_pipeline_uuid }}

  cleanup:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Delete branch
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/mirror-to-bitbucket@main
        with:
          bitbucket_username: ${{ secrets.BITBUCKET_USERNAME }}
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
          bitbucket_user_email: ${{ secrets.BITBUCKET_USER_EMAIL }}
          branch_name: ${{ github.event.pull_request.head.ref }}
          action_type: delete
```

**Note**: When using composite actions directly, you'll need a separate workflow for `push` events to handle default branch mirroring.

## Deprecated Workflow

The combined workflow `reusable-mirror-to-bitbucket.yml` is deprecated but kept for backward compatibility. Please migrate to the split workflows above.

## License

MIT

