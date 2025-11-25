# Wait for Bitbucket Pipeline Action

## What This Action Does

This action waits for a Bitbucket pipeline to finish running. It checks the pipeline status repeatedly until the pipeline completes or times out.

## When to Use It

Use this action when you want to:
- Wait for a Bitbucket pipeline to finish before continuing your GitHub Actions workflow
- Check if a Bitbucket pipeline succeeded or failed
- Get information about a pipeline that was triggered from GitHub Actions

## Required Inputs

You must provide these inputs:

- **bitbucket_api_token**: A Bitbucket API token with permission to read repository information.
- **bitbucket_repo**: The Bitbucket repository path in the format `workspace/repo-name`. For example: `mycompany/myproject`.

## Optional Inputs

- **commit_sha**: The git commit SHA to check the pipeline for. If you don't provide this, it uses the current commit (HEAD).
- **poll_interval**: How many seconds to wait between each check. Defaults to 30 seconds.
- **max_attempts**: The maximum number of times to check before giving up. Defaults to 60 attempts.
- **expected_pipeline_uuid**: A specific pipeline UUID to look for. Use this when there might be multiple pipelines for the same commit and you want to wait for a specific one.

## Outputs

The action provides these outputs:

- **pipeline_uuid**: The UUID of the Bitbucket pipeline that was found.
- **pipeline_state**: The final state of the pipeline (usually `COMPLETED`).
- **pipeline_result**: Whether the pipeline succeeded or failed (`SUCCESSFUL` or `FAILED`).
- **pipeline_url**: A link to view the pipeline in the Bitbucket dashboard.
- **error_message**: Details about what went wrong if the pipeline failed.

## How It Works

1. It waits 30 seconds to give the pipeline time to start.
2. It checks the Bitbucket API every few seconds (based on `poll_interval`) to see if the pipeline has finished.
3. It looks for pipelines that match the commit SHA you provided.
4. If you provided an `expected_pipeline_uuid`, it tries to find that specific pipeline.
5. It keeps checking until the pipeline completes or you reach the maximum number of attempts.
6. If the pipeline succeeds, the action succeeds. If the pipeline fails, the action fails with error details.

## Example Usage

### Basic Wait

```yaml
- uses: ./.github/actions/wait-for-bitbucket-pipeline
  with:
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: myworkspace/myrepo
```

### Wait for Specific Commit

```yaml
- uses: ./.github/actions/wait-for-bitbucket-pipeline
  with:
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: myworkspace/myrepo
    commit_sha: abc123def456
```

### Wait for Specific Pipeline

```yaml
- uses: ./.github/actions/wait-for-bitbucket-pipeline
  with:
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: myworkspace/myrepo
    expected_pipeline_uuid: {12345678-1234-1234-1234-123456789abc}
```

### Custom Polling Settings

```yaml
- uses: ./.github/actions/wait-for-bitbucket-pipeline
  with:
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: myworkspace/myrepo
    poll_interval: 15
    max_attempts: 120
```

## Using the Outputs

You can use the outputs in later steps:

```yaml
- uses: ./.github/actions/wait-for-bitbucket-pipeline
  id: wait-pipeline
  with:
    bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
    bitbucket_repo: myworkspace/myrepo

- name: Check pipeline result
  run: |
    echo "Pipeline UUID: ${{ steps.wait-pipeline.outputs.pipeline_uuid }}"
    echo "Pipeline URL: ${{ steps.wait-pipeline.outputs.pipeline_url }}"
    echo "Pipeline Result: ${{ steps.wait-pipeline.outputs.pipeline_result }}"
```

## Notes

- The action waits 30 seconds before starting to check. This gives the pipeline time to appear in the Bitbucket API.
- If multiple pipelines exist for the same commit, the action uses the most recent one unless you provide an `expected_pipeline_uuid`.
- The action will fail if the pipeline fails, which will also fail your GitHub Actions workflow.
- You need a Bitbucket API token with repository read permissions.
- The total maximum wait time is `poll_interval × max_attempts` seconds. With defaults, this is 30 × 60 = 1800 seconds (30 minutes).






