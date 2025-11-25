# Mirror GitHub to Bitbucket Workflow Documentation

## What This Workflow Does

This workflow automatically keeps your Bitbucket repository in sync with your GitHub repository and waits for Bitbucket pipelines to complete. It runs whenever someone opens, updates, synchronizes, reopens, or closes a pull request on GitHub.

The workflow performs two main functions:
1. **Mirroring**: Copies branches from GitHub to Bitbucket
2. **Pipeline Monitoring**: Waits for Bitbucket pipelines to complete and reports their status

## When It Runs

The workflow starts automatically when:
- A pull request is **opened** targeting `main` or `master`
- A pull request is **reopened** targeting `main` or `master`
- A pull request is **synchronized** (new commits are added) targeting `main` or `master`
- A pull request is **closed** targeting `main` or `master`

**Important**: 
- The workflow only runs for pull requests targeting `main` or `master`. Pull requests targeting other branches will not trigger this workflow.
- **Release branches (`release/staging`, `release/production`) are excluded** to prevent automatic deployments. Deployments to staging/production must be triggered manually via the `manual-deployment.yml` workflow.

## What Happens in Each Scenario

### Scenario 1: Pull Request Opened, Reopened, or Updated

When someone opens a pull request, reopens it, or adds new commits to it:
- The workflow checks out the pull request branch
- It copies that branch to Bitbucket (or triggers the pipeline via API if the commit already exists)
- The branch name stays the same on both platforms
- It waits for the Bitbucket pipeline to complete
- The workflow succeeds if the pipeline succeeds, or fails if the pipeline fails

**Idempotent Behavior**: If the same commit already exists on Bitbucket, the workflow doesn't push again. Instead, it triggers the pipeline via the Bitbucket API to avoid duplicate pushes while still running the pipeline.

### Scenario 2: Pull Request Closed (Not Merged)

When someone closes a pull request without merging it:
- The workflow checks out the pull request branch.
- By default, it **deletes** the branch from Bitbucket (using `git push :branch-name`).
- The branch is not merged into the main branch.
- The branch is completely removed from Bitbucket.
- The workflow does **not** wait for any pipeline (since no push occurs).

You can control this behavior using the `ALLOW_BRANCH_DELETION` environment variable:

- `ALLOW_BRANCH_DELETION: "true"` (default): when a PR is closed without merging, the branch is deleted from Bitbucket.
- `ALLOW_BRANCH_DELETION: "false"`: branches are **not** deleted from Bitbucket; the action logs that deletion was skipped.

This makes it easy to align the workflow with your Bitbucket branch deletion policy while keeping the rest of the mirroring behavior unchanged.

### Scenario 3: Pull Request Merged

When a pull request is merged into the target branch (`main` or `master`):
- The workflow checks out the target branch (base branch)
- It copies the updated target branch to Bitbucket
- This ensures Bitbucket has the latest merged code
- It waits for the Bitbucket pipeline to complete
- The workflow succeeds if the pipeline succeeds, or fails if the pipeline fails

**Note**: PRs merged into `release/staging` or `release/production` will **not** trigger this workflow. Deployments to staging/production must be triggered manually using the `manual-deployment.yml` workflow.

## Required Secrets

You need to set up these secrets in your GitHub repository settings:

1. **BITBUCKET_USERNAME**: Your Bitbucket username or "x-token-auth" if required by your Bitbucket API token setup
2. **BITBUCKET_API_TOKEN**: A Bitbucket API token/app token with repository write permissions
3. **BITBUCKET_REPO**: The Bitbucket repository path in the format "owner/repository-name"
4. **BITBUCKET_USER_EMAIL**: An email address for Git commits (can be a bot email)

## How It Works Step by Step

### Step 1: Checkout the Right Branch

The workflow first decides which branch to work with:
- If the pull request was merged, it checks out the main branch (base branch)
- Otherwise, it checks out the pull request branch (head branch)

### Step 2: Set Up Git Identity

The workflow configures Git to use a bot identity for all commits. This makes it clear that the changes came from the automated mirroring process.

### Step 3: Mirror or Delete the Branch

The workflow uses the `mirror-to-bitbucket` custom action to:
- Connect to your Bitbucket repository
- Check if the commit already exists on Bitbucket
- **If the commit is new**: Push the branch to Bitbucket
- **If the commit already exists**: Trigger the pipeline via Bitbucket API (idempotent behavior)
- **If the PR was closed without merging**: Delete the branch from Bitbucket

The action returns a `triggered_pipeline_uuid` output that identifies which pipeline was triggered.

### Step 4: Wait for Bitbucket Pipeline (If Applicable)

If the workflow pushed or triggered a pipeline (i.e., the PR was not closed without merging):
- The workflow uses the `wait-for-bitbucket-pipeline` custom action
- It waits 30 seconds to give the pipeline time to start
- It polls the Bitbucket API every 30 seconds (configurable)
- It looks for the specific pipeline using the UUID from step 3
- It continues polling until the pipeline completes or times out (default: 60 attempts = 30 minutes)
- **If the pipeline succeeds**: The workflow step succeeds
- **If the pipeline fails**: The workflow step fails with error details

## Technical Details

- The workflow runs on Ubuntu (latest version)
- It fetches the full Git history (fetch-depth: 0) to ensure all commits are available
- The `mirror-to-bitbucket` action handles the actual pushing, pipeline triggering, and branch deletion logic
- The `wait-for-bitbucket-pipeline` action handles pipeline monitoring and status reporting
- Branch names are preserved between GitHub and Bitbucket
- The workflow is idempotent: running it multiple times with the same commit won't create duplicate pushes
- Pipeline waiting is skipped when a PR is closed without merging (no pipeline to wait for)

## Pipeline Behavior

### Idempotent Pushes

The workflow is designed to be idempotent. If you run it multiple times with the same commit:
- The first run pushes the branch to Bitbucket
- Subsequent runs detect that the commit already exists
- Instead of pushing again, it triggers the pipeline via the Bitbucket API
- This prevents duplicate pushes while still ensuring pipelines run

### Pipeline Monitoring

After pushing or triggering a pipeline, the workflow:
- Waits 30 seconds for the pipeline to appear in the Bitbucket API
- Polls every 30 seconds (configurable via `poll_interval`)
- Times out after 60 attempts (configurable via `max_attempts`)
- Uses the pipeline UUID to find the correct pipeline when multiple pipelines exist for the same commit
- Provides detailed error messages if the pipeline fails, including failed step information

### Pipeline Failure Handling

If a Bitbucket pipeline fails:
- The workflow step fails with a clear error message
- The error message includes a link to view the pipeline in Bitbucket
- Failed step details are included in the error output
- The entire GitHub Actions workflow fails, making it easy to see when Bitbucket pipelines have issues

## Notes

- This workflow only handles pull request events. It does not mirror regular commits to branches or direct pushes.
- The workflow **only runs for pull requests targeting**: `main` or `master`.
- **Release branches (`release/staging`, `release/production`) are excluded** from automatic mirroring to prevent automatic deployments.
- Pull requests targeting other branches (including release branches) will not trigger this workflow.
- **Deployments to staging/production must be triggered manually** using the `manual-deployment.yml` workflow.
- The workflow preserves branch names, so a branch called "feature/new-feature" on GitHub will have the same name on Bitbucket.
- When a pull request is closed without merging, the branch is **deleted** from Bitbucket (not just closed or cancelled).
- The workflow waits for Bitbucket pipelines to complete, so your GitHub Actions workflow will reflect the status of your Bitbucket pipelines.
- Pipeline waiting is skipped when deleting branches (no pipeline to wait for).
- The workflow uses the Bitbucket API to trigger pipelines when commits already exist, avoiding unnecessary git pushes.

