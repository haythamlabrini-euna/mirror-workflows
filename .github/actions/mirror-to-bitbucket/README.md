# Mirror to Bitbucket Action

## What This Action Does

This action copies your GitHub branch to a Bitbucket repository. It pushes your code to Bitbucket so that Bitbucket pipelines can run on it.

## When to Use It

Use this action when you want to:
- Mirror a GitHub branch to Bitbucket
- Trigger Bitbucket pipelines from GitHub Actions
- Keep your Bitbucket repository in sync with GitHub
- Delete a branch from Bitbucket

## Required Inputs

You must provide these inputs:

- **bitbucket_username**: Your Bitbucket username. If using an API token/app token, some setups require `x-token-auth` as the username.
- **bitbucket_api_token**: A Bitbucket API token/app token with permission to write to repositories.
- **bitbucket_repo**: The Bitbucket repository path in the format `workspace/repo-name`. For example: `mycompany/myproject`.
- **bitbucket_user_email**: An email address for git configuration. This can be a bot email address.

## Optional Inputs

- **branch_name**: The branch name to push or delete. If you don't provide this, it uses the current GitHub branch name.
- **action_type**: What action to perform. Use `push` to mirror the branch (this is the default) or `delete` to remove the branch from Bitbucket.
- **force_trigger**: Set to `true` if you want to always push, even if the commit already exists. This is useful for retriggering pipelines. Defaults to `false` for idempotent behavior.
- **allow_branch_deletion**: Set to `false` if you want to skip deleting branches on Bitbucket even when `action_type` is `delete`. Defaults to `true` to preserve the current behavior of deleting PR branches when they are closed without merging.

## Outputs

The action provides these outputs:

- **branch_pushed**: The name of the branch that was pushed or deleted.
- **push_occurred**: Whether a push actually happened (`true`) or was skipped because the commit already exists (`false`).
- **triggered_pipeline_uuid**: The UUID of any pipeline that was triggered via the Bitbucket API.

## How It Works

1. It adds Bitbucket as a git remote using your credentials.
2. It checks if the commit already exists on the Bitbucket branch.
3. If the commit is new, it pushes the branch to Bitbucket.
4. If the commit already exists, it triggers the pipeline via the Bitbucket API instead of pushing again.
5. If you set `action_type` to `delete`, it removes the branch from Bitbucket.

## Example Usage

### Basic Mirror

```yaml
- uses: ./.github/actions/mirror-to-bitbucket
  with:
    bitbucket_username: ${{ secrets.BITBUCKET_USERNAME }}
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: myworkspace/myrepo
    bitbucket_user_email: bot@example.com
```

### Delete a Branch

```yaml
- uses: ./.github/actions/mirror-to-bitbucket
  with:
    bitbucket_username: ${{ secrets.BITBUCKET_USERNAME }}
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: myworkspace/myrepo
    bitbucket_user_email: bot@example.com
    action_type: delete
    branch_name: feature-branch
```

### Force Trigger Pipeline

```yaml
- uses: ./.github/actions/mirror-to-bitbucket
  with:
    bitbucket_username: ${{ secrets.BITBUCKET_USERNAME }}
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: myworkspace/myrepo
    bitbucket_user_email: bot@example.com
    force_trigger: true
```

## Notes

- The action is idempotent by default. If the same commit already exists on Bitbucket, it won't push again. Instead, it will trigger the pipeline via API.
- You need a Bitbucket API token/app token with repository write permissions on both pipelines and repos.
- The action automatically configures git with a bot identity for the push operation.

