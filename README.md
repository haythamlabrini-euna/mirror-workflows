# Mirror Workflows

Reusable GitHub Actions and workflows for mirroring repositories to Bitbucket.

## Features

- **Mirror branches** from GitHub to Bitbucket
- **Delete branches** on Bitbucket when PRs are closed
- **Wait for Bitbucket pipelines** to complete and report status
- **Trigger pipelines** via API when commits already exist

## Quick Start

### Option 1: Use the Reusable Workflow (Recommended)

The simplest way to use this from another repository:

```yaml
# .github/workflows/mirror.yml
name: Mirror to Bitbucket

on:
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize, closed]

jobs:
  mirror:
    uses: haythamlabrini-euna/mirror-workflows/.github/workflows/reusable-mirror-to-bitbucket.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref || github.ref_name }}
      action_type: ${{ github.event.action == 'closed' && !github.event.pull_request.merged && 'delete' || 'push' }}
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_REPO: ${{ secrets.BITBUCKET_REPO }}
      BITBUCKET_USER_EMAIL: ${{ secrets.BITBUCKET_USER_EMAIL }}
```

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

## Reusable Workflow Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `branch_name` | Yes | - | Branch name to push or delete |
| `action_type` | No | `push` | Action: `push` or `delete` |
| `force_trigger` | No | `false` | Force push even if commit exists |
| `allow_branch_deletion` | No | `true` | Allow branch deletion on Bitbucket |
| `wait_for_pipeline` | No | `true` | Wait for Bitbucket pipeline to complete |
| `poll_interval` | No | `30` | Seconds between pipeline status checks |
| `max_attempts` | No | `60` | Max polling attempts before timeout |

## Workflow Outputs

| Output | Description |
|--------|-------------|
| `branch_pushed` | The branch name that was pushed |
| `push_occurred` | Whether a push actually occurred |
| `pipeline_result` | Final result of the Bitbucket pipeline |
| `pipeline_url` | URL to view the pipeline in Bitbucket |

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

```yaml
# .github/workflows/mirror-pr.yml
name: Mirror PRs to Bitbucket

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]
    branches: [main, master]

jobs:
  mirror:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.merged && github.event.pull_request.base.ref || github.event.pull_request.head.ref }}
          fetch-depth: 0

      - name: Mirror branch
        id: mirror
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/mirror-to-bitbucket@main
        with:
          bitbucket_username: ${{ secrets.BITBUCKET_USERNAME }}
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
          bitbucket_user_email: ${{ secrets.BITBUCKET_USER_EMAIL }}
          # Mirror base branch if merged, otherwise mirror PR branch
          branch_name: ${{ github.event.pull_request.merged && github.event.pull_request.base.ref || github.event.pull_request.head.ref }}
          # Delete branch if PR closed without merge
          action_type: ${{ github.event.action == 'closed' && !github.event.pull_request.merged && 'delete' || 'push' }}

      - name: Wait for pipeline
        if: ${{ !(github.event.action == 'closed' && !github.event.pull_request.merged) && steps.mirror.outputs.pipelines_configured == 'true' }}
        uses: haythamlabrini-euna/mirror-workflows/.github/actions/wait-for-bitbucket-pipeline@main
        with:
          bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
          bitbucket_repo: ${{ secrets.BITBUCKET_REPO }}
          expected_pipeline_uuid: ${{ steps.mirror.outputs.triggered_pipeline_uuid }}
```

## License

MIT

