# Setup Pipeline URL Action

A reusable composite action that constructs the Bitbucket pipeline URL from workspace, repository slug, and pipeline UUID.

## Usage

### As a Composite Action Step

```yaml
- name: Setup Pipeline URL
  uses: ./.github/actions/setup-pipeline-url
  id: setup-url
  with:
    workspace: 'my-workspace'
    repo_slug: 'my-repo'
    uuid: '12345678-1234-1234-1234-123456789abc'

- name: Use Pipeline URL
  run: echo "Pipeline URL: ${{ steps.setup-url.outputs.pipeline_url }}"
```

### As a Bash Script

The action also provides a standalone bash script that can be used within workflow run blocks:

```bash
# Source or call the script directly
PIPELINE_URL=$(bash .github/actions/setup-pipeline-url/setup-pipeline-url.sh \
  "my-workspace" \
  "my-repo" \
  "12345678-1234-1234-1234-123456789abc")

echo "Pipeline URL: ${PIPELINE_URL}"
```

### As a Helper Function (in workflows)

The workflows use an inline helper function that matches this action's logic:

```bash
setup_pipeline_url() {
  local workspace="$1"
  local repo_slug="$2"
  local uuid="$3"
  local clean_uuid=$(echo "${uuid}" | tr -d '{}')
  echo "https://bitbucket.org/${workspace}/${repo_slug}/addon/pipelines/home#!/results/{${clean_uuid}}"
}

# Usage
URL=$(setup_pipeline_url "workspace" "repo" "uuid")
```

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `workspace` | Yes | Bitbucket workspace name |
| `repo_slug` | Yes | Bitbucket repository slug |
| `uuid` | Yes | Pipeline UUID (with or without curly braces) |

## Outputs

| Output | Description |
|--------|-------------|
| `pipeline_url` | URL to view the pipeline in Bitbucket dashboard |

## URL Format

The constructed URL follows this format:
```
https://bitbucket.org/{workspace}/{repo_slug}/addon/pipelines/home#!/results/{{uuid}}
```

## Notes

- The UUID can be provided with or without curly braces (e.g., `{123...}` or `123...`)
- The action automatically removes curly braces if present
- This action is used internally by the mirror workflows to ensure consistent URL construction

