# Trigger Bitbucket Custom Pipeline Action

Triggers a specific Bitbucket custom pipeline (for example `contract-test` or `e2e-bootstrap`) on a branch.

## Inputs
- `bitbucket_api_token` (required): Bitbucket API token/app password with permission to trigger pipelines.
- `bitbucket_repo` (required): Repository in `workspace/repo-slug` format.
- `pipeline_name` (required): Name under `pipelines.custom` in `bitbucket-pipelines.yml`.
- `branch_name` (optional): Branch to target. Defaults to `main`.

## Outputs
- `triggered_pipeline_uuid`: UUID of the triggered pipeline (without braces).
- `pipeline_url`: Direct link to the pipeline run in Bitbucket.

## Example (direct use)
```yaml
steps:
  - name: Trigger Bitbucket custom pipeline
    uses: ./.github/actions/trigger-custom-pipeline
    with:
      bitbucket_api_token: ${{ secrets.BITBUCKET_API_TOKEN }}
      bitbucket_repo: "workspace/repo-slug"
      pipeline_name: contract-test
      branch_name: main
```

## Example (via reusable workflow)
See `.github/workflows/reusable-trigger-custom-pipeline.yml`:
```yaml
jobs:
  trigger:
    uses: <owner>/mirror-workflows/.github/workflows/reusable-trigger-custom-pipeline.yml@main
    with:
      pipeline_name: contract-test
      branch_name: main
      bitbucket_repo: "workspace/repo-slug"
      wait_for_pipeline: true
    secrets:
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
```

