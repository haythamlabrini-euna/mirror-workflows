# Mirror Workflows

Reusable GitHub Actions and workflows for mirroring repositories to Bitbucket.

## Features

- **Mirror branches** from GitHub to Bitbucket
- **Mirror tags** from GitHub to Bitbucket (e.g., `v*` semantic version tags)
- **Delete branches** on Bitbucket when PRs are closed
- **Wait for Bitbucket pipelines** to complete and report status
- **Trigger pipelines** via API when commits already exist
- **Trigger custom Bitbucket pipelines** (e.g., `contract-test`, `e2e-bootstrap`) on specific branches

## Reusable Workflows

This repository provides four purpose-specific reusable workflows:

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `reusable-mirror-branch.yml` | Mirror a branch to Bitbucket | Push events, PR opened/synchronized |
| `reusable-mirror-tag.yml` | Mirror a tag to Bitbucket | Tag push events (e.g., `v*`) |
| `reusable-delete-branch.yml` | Delete a branch from Bitbucket | PR closed (merged or not) |
| `reusable-trigger-custom-pipeline.yml` | Trigger a custom Bitbucket pipeline | Manual triggers, scheduled jobs, or after specific events |

## Quick Start

### Recommended: Use Split Workflows

The simplest way to use this from another repository:

```yaml
# .github/workflows/mirror.yml
name: Mirror to Bitbucket

on:
  # Mirror default branch (main/master) when commits are pushed
  # Mirror semantic version tags (v*) when pushed
  push:
    branches: [main, master]
    tags: ['v*']
  # Handle PR events: mirror PR branch, cleanup on close/merge
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main, master]

jobs:
  # Job 1: Mirror branch on push (not tags) or PR open/sync
  mirror-branch:
    if: (github.event_name == 'push' && !startsWith(github.ref, 'refs/tags/')) || github.event.action != 'closed'
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-mirror-branch.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref || github.ref_name }}
      bitbucket_repo: ${{ vars.BITBUCKET_REPO }}
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_USER_EMAIL: ${{ secrets.BITBUCKET_USER_EMAIL }}

  # Job 2: Mirror tag on push (only tags)
  mirror-tag:
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-mirror-tag.yml@main
    with:
      tag_name: ${{ github.ref_name }}
      bitbucket_repo: ${{ vars.BITBUCKET_REPO }}
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_USER_EMAIL: ${{ secrets.BITBUCKET_USER_EMAIL }}

  # Job 3: Delete PR branch on close (merged or not)
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
| Push tag (v*) | `reusable-mirror-tag.yml` | Mirrors tag |
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

### `reusable-mirror-tag.yml`

Mirrors a tag from GitHub to Bitbucket, optionally waits for pipeline.

**Inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `tag_name` | Yes | - | Tag name to mirror (e.g., `v1.0.0`) |
| `wait_for_pipeline` | No | `true` | Wait for Bitbucket pipeline to complete |
| `poll_interval` | No | `30` | Seconds between pipeline status checks |
| `max_attempts` | No | `60` | Max polling attempts before timeout |

**Outputs:**

| Output | Description |
|--------|-------------|
| `tag_pushed` | The tag name that was pushed |
| `push_occurred` | Whether a push actually occurred (false if tag already exists) |
| `bitbucket_commit_sha` | The commit SHA that the tag points to |
| `pipeline_result` | Final result of the Bitbucket pipeline |
| `pipeline_url` | URL to view the pipeline in Bitbucket |

### `reusable-trigger-custom-pipeline.yml`

Triggers a specific custom Bitbucket pipeline (e.g., `contract-test`, `e2e-bootstrap`) on a branch. Optionally waits for the pipeline to complete.

**Inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `pipeline_name` | Yes | - | Custom pipeline name as defined under `pipelines.custom` in `bitbucket-pipelines.yml` |
| `branch_name` | No | `main` | Branch to target for the pipeline |
| `bitbucket_repo` | Yes | - | Bitbucket repository in `workspace/repo-slug` format |
| `wait_for_pipeline` | No | `true` | If true, poll Bitbucket until the pipeline finishes |
| `poll_interval` | No | `30` | Seconds between polling attempts when waiting |
| `max_attempts` | No | `60` | Maximum polling attempts before timing out |

**Outputs:**

| Output | Description |
|--------|-------------|
| `pipeline_uuid` | UUID of the triggered pipeline |
| `pipeline_url` | URL to view the pipeline in Bitbucket |
| `pipeline_result` | Final pipeline result when `wait_for_pipeline=true` (e.g., `SUCCESSFUL`, `FAILED`) |

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

### `trigger-custom-pipeline`

Triggers a specific custom Bitbucket pipeline (e.g., `contract-test`, `e2e-bootstrap`) on a branch. This is useful when you need to trigger a custom pipeline that's already defined in `bitbucket-pipelines.yml` under the `pipelines.custom` section.

```yaml
- uses: haythamlabrini-euna/mirror-workflows/.github/actions/trigger-custom-pipeline@main
  with:
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
    pipeline_name: contract-test       # Name of the custom pipeline
    branch_name: main                  # Optional, defaults to main
```

**Outputs:**
- `triggered_pipeline_uuid`: UUID of the triggered pipeline (without braces)
- `pipeline_url`: Direct link to the pipeline run in Bitbucket

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

## Complete Example: Full Mirroring Workflow

### Using Split Reusable Workflows (Recommended)

This example handles branches, tags, and PR scenarios using the split workflows:

```yaml
# .github/workflows/mirror.yml
name: Mirror to Bitbucket

on:
  # Mirror default branch when commits are pushed (including merge commits)
  # Mirror semantic version tags when pushed
  push:
    branches: [main, master]
    tags: ['v*']
  # Handle PR lifecycle events
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main, master]

jobs:
  # Mirror branch on push events (not tags) or PR open/sync
  mirror-branch:
    if: (github.event_name == 'push' && !startsWith(github.ref, 'refs/tags/')) || github.event.action != 'closed'
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-mirror-branch.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref || github.ref_name }}
      bitbucket_repo: ${{ vars.BITBUCKET_REPO }}
      wait_for_pipeline: true
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_USER_EMAIL: ${{ secrets.BITBUCKET_USER_EMAIL }}

  # Mirror tag on push events (only tags)
  mirror-tag:
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-mirror-tag.yml@main
    with:
      tag_name: ${{ github.ref_name }}
      bitbucket_repo: ${{ vars.BITBUCKET_REPO }}
      wait_for_pipeline: true
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
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
│                           MIRRORING EVENTS                                  │
├─────────────────────────┬───────────────────────────────────────────────────┤
│ Push to main/master     │ → reusable-mirror-branch.yml → Mirror branch     │
├─────────────────────────┼───────────────────────────────────────────────────┤
│ Push tag (v*)           │ → reusable-mirror-tag.yml → Mirror tag           │
├─────────────────────────┼───────────────────────────────────────────────────┤
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

### Example: Trigger Custom Pipeline

Trigger a custom Bitbucket pipeline (e.g., `contract-test` or `e2e-bootstrap`) using the reusable workflow:

```yaml
# .github/workflows/trigger-pipeline.yml
name: Trigger Custom Pipeline

on:
  workflow_dispatch:
    inputs:
      pipeline_name:
        description: 'Pipeline to trigger'
        required: true
        type: choice
        options:
          - contract-test
          - e2e-bootstrap
      branch_name:
        description: 'Branch to target'
        required: false
        default: 'main'

jobs:
  trigger:
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-trigger-custom-pipeline.yml@main
    with:
      pipeline_name: ${{ github.event.inputs.pipeline_name }}
      branch_name: ${{ github.event.inputs.branch_name || 'main' }}
      bitbucket_repo: ${{ vars.BITBUCKET_REPO }}
      wait_for_pipeline: true
    secrets:
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
```

Or use the action directly for more control:

```yaml
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger custom pipeline
        id: trigger
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/trigger-custom-pipeline@main
        with:
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
          pipeline_name: contract-test
          branch_name: main

      - name: Wait for pipeline
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/wait-for-bitbucket-pipeline@main
        with:
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
          expected_pipeline_uuid: ${{ steps.trigger.outputs.triggered_pipeline_uuid }}
```

## Deprecated Workflow

The combined workflow `reusable-mirror-to-bitbucket.yml` is deprecated but kept for backward compatibility. Please migrate to the split workflows above.

## License

MIT

