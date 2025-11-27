# Workflow Requirements

This document describes the requirements and behavior for mirroring GitHub repositories to Bitbucket.

## Requirements Overview

### 1. PR Opened Toward Default Branch (main/master)

**Trigger:** `pull_request` event with types `opened`, `synchronize`, `reopened`

**Action:** Mirror the PR branch to Bitbucket

**Workflow:** `reusable-mirror-branch.yml`

**Details:**
- When a PR is opened targeting main/master, the PR's source branch should be mirrored to Bitbucket
- This allows Bitbucket pipelines to run on the PR branch
- On each new commit to the PR (synchronize), the branch is updated on Bitbucket

---

### 2. PR Closed (Not Merged)

**Trigger:** `pull_request` event with type `closed` and `merged == false`

**Action:** Optionally delete the PR branch from Bitbucket

**Workflow:** `reusable-delete-branch.yml`

**Details:**
- When a PR is closed without being merged, the PR branch can be deleted from Bitbucket for cleanup
- Deletion is controlled by the `allow_deletion` input (default: `true`)
- If the branch doesn't exist on Bitbucket, the workflow completes successfully (no error)

---

### 3. PR Merged

**Trigger:** `pull_request` event with type `closed` and `merged == true`

**Actions:**
1. **Delete the PR branch** from Bitbucket (cleanup)
2. **Mirror the default branch** to Bitbucket (triggered separately by push event)

**Workflows:**
- `reusable-delete-branch.yml` - Handles PR branch cleanup
- `reusable-mirror-branch.yml` - Handles default branch mirroring (via push event)

**Details:**
- When a PR is merged, GitHub creates a merge commit on the default branch (main/master)
- This merge commit triggers a `push` event on the default branch
- The `push` event calls `reusable-mirror-branch.yml` to mirror main/master to Bitbucket
- The `closed` event calls `reusable-delete-branch.yml` to delete the PR branch from Bitbucket

---

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB EVENTS                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  push to main/      │   │  pull_request       │   │  pull_request       │
│  master             │   │  opened/synchronize │   │  closed             │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
          │                           │                           │
          │                           │               ┌───────────┴───────────┐
          │                           │               │                       │
          ▼                           ▼               ▼                       ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌───────────┐   ┌───────────┐
│ reusable-mirror-    │   │ reusable-mirror-    │   │  merged   │   │   not     │
│ branch.yml          │   │ branch.yml          │   │           │   │  merged   │
└─────────────────────┘   └─────────────────────┘   └───────────┘   └───────────┘
          │                           │                   │               │
          ▼                           ▼                   │               │
┌─────────────────────┐   ┌─────────────────────┐        │               │
│ Mirror default      │   │ Mirror PR branch    │        │               │
│ branch to Bitbucket │   │ to Bitbucket        │        │               │
└─────────────────────┘   └─────────────────────┘        │               │
                                                          │               │
                                                          ▼               ▼
                                              ┌─────────────────────────────────┐
                                              │   reusable-delete-branch.yml    │
                                              └─────────────────────────────────┘
                                                          │
                                                          ▼
                                              ┌─────────────────────────────────┐
                                              │   Delete PR branch from         │
                                              │   Bitbucket (cleanup)           │
                                              └─────────────────────────────────┘
```

---

## Merged PR: Two Events

When a PR is merged, two GitHub events are triggered:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            PR MERGED ON GITHUB                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
         ┌─────────────────────┐             ┌─────────────────────┐
         │ Event 1:            │             │ Event 2:            │
         │ pull_request.closed │             │ push                │
         │ (merged = true)     │             │ (to main/master)    │
         └─────────────────────┘             └─────────────────────┘
                    │                                   │
                    ▼                                   ▼
         ┌─────────────────────┐             ┌─────────────────────┐
         │ Workflow:           │             │ Workflow:           │
         │ reusable-delete-    │             │ reusable-mirror-    │
         │ branch.yml          │             │ branch.yml          │
         └─────────────────────┘             └─────────────────────┘
                    │                                   │
                    ▼                                   ▼
         ┌─────────────────────┐             ┌─────────────────────┐
         │ Result:             │             │ Result:             │
         │ Delete PR branch    │             │ Mirror main/master  │
         │ from Bitbucket      │             │ to Bitbucket        │
         └─────────────────────┘             └─────────────────────┘
```

---

## Event-to-Workflow Mapping Table

| GitHub Event | Condition | Workflow | Action on Bitbucket |
|--------------|-----------|----------|---------------------|
| `push` | Branch is main/master | `reusable-mirror-branch.yml` | Mirror default branch |
| `pull_request.opened` | Target is main/master | `reusable-mirror-branch.yml` | Mirror PR branch |
| `pull_request.synchronize` | Target is main/master | `reusable-mirror-branch.yml` | Update PR branch |
| `pull_request.reopened` | Target is main/master | `reusable-mirror-branch.yml` | Mirror PR branch |
| `pull_request.closed` | `merged == false` | `reusable-delete-branch.yml` | Delete PR branch (optional) |
| `pull_request.closed` | `merged == true` | `reusable-delete-branch.yml` | Delete PR branch (cleanup) |

---

## Workflow Inputs Summary

### `reusable-mirror-branch.yml`

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `branch_name` | Yes | - | Branch name to mirror |
| `wait_for_pipeline` | No | `true` | Wait for Bitbucket pipeline to complete |
| `poll_interval` | No | `30` | Seconds between pipeline status checks |
| `max_attempts` | No | `60` | Max polling attempts before timeout |

### `reusable-delete-branch.yml`

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `branch_name` | Yes | - | Branch name to delete |
| `allow_deletion` | No | `true` | If false, skip deletion |

---

## Example Caller Workflow

```yaml
name: Mirror to Bitbucket

on:
  push:
    branches: [main, master]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main, master]

jobs:
  # Mirror branch on push or PR open/sync
  mirror:
    if: github.event_name == 'push' || github.event.action != 'closed'
    uses: <owner>/mirror-workflows/.github/workflows/reusable-mirror-branch.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref || github.ref_name }}
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_REPO: ${{ secrets.BITBUCKET_REPO }}
      BITBUCKET_USER_EMAIL: ${{ secrets.BITBUCKET_USER_EMAIL }}

  # Delete PR branch on close (merged or not)
  cleanup:
    if: github.event.action == 'closed'
    uses: <owner>/mirror-workflows/.github/workflows/reusable-delete-branch.yml@main
    with:
      branch_name: ${{ github.event.pull_request.head.ref }}
    secrets:
      BITBUCKET_USERNAME: ${{ secrets.BITBUCKET_USERNAME }}
      BITBUCKET_API_TOKEN: ${{ secrets.BITBUCKET_API_TOKEN }}
      BITBUCKET_REPO: ${{ secrets.BITBUCKET_REPO }}
```

---

## Required Secrets

| Secret | Description |
|--------|-------------|
| `BITBUCKET_USERNAME` | Bitbucket username or `x-token-auth` for app passwords |
| `BITBUCKET_API_TOKEN` | Bitbucket API token or app password with repository write access |
| `BITBUCKET_REPO` | Bitbucket repository in `workspace/repo-slug` format |
| `BITBUCKET_USER_EMAIL` | Email address for git commits (only required for mirror workflow) |

