import * as fs from 'fs';
import * as os from 'os';

// Helper to write GitHub Action outputs in a safe way.
function setOutput(name: string, value: string) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}${os.EOL}`);
  } else {
    console.log(`[OUTPUT] ${name}=${value}`);
  }
}

async function main() {
  try {
    // Required inputs from environment.
    const BITBUCKET_API_TOKEN = process.env.BITBUCKET_API_TOKEN;
    const BITBUCKET_REPO = process.env.BITBUCKET_REPO;
    const PIPELINE_NAME = process.env.PIPELINE_NAME;
    const BRANCH_NAME = process.env.BRANCH_NAME || 'main';

    // Guard against missing inputs early so we fail fast with a clear message.
    if (!BITBUCKET_API_TOKEN || !BITBUCKET_REPO || !PIPELINE_NAME) {
      throw new Error('❌ Missing required inputs: BITBUCKET_API_TOKEN, BITBUCKET_REPO, or PIPELINE_NAME');
    }

    const [workspace, repoSlug] = BITBUCKET_REPO.split('/');
    if (!workspace || !repoSlug) {
      throw new Error('❌ BITBUCKET_REPO must be in the format "workspace/repo-slug"');
    }

    // Build payload for Bitbucket API. Custom selector runs the named pipeline under pipelines.custom.
    const payload = {
      target: {
        type: 'pipeline_ref_target',
        ref_type: 'branch',
        ref_name: BRANCH_NAME,
        selector: {
          type: 'custom',
          pattern: PIPELINE_NAME
        }
      }
    };

    console.log(`Triggering Bitbucket custom pipeline '${PIPELINE_NAME}' on branch '${BRANCH_NAME}'`);

    // Call Bitbucket Pipelines REST API to start the custom pipeline.
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BITBUCKET_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data: any = await response.json().catch(() => ({}));

    if (response.ok && data.uuid) {
      const uuid = data.uuid.replace(/[{}]/g, '');
      const pipelineUrl = `https://bitbucket.org/${workspace}/${repoSlug}/addon/pipelines/home#!/results/${uuid}`;

      console.log(`✅ Custom pipeline triggered (UUID: ${uuid})`);
      console.log(`🔗 Pipeline URL: ${pipelineUrl}`);

      setOutput('triggered_pipeline_uuid', uuid);
      setOutput('pipeline_url', pipelineUrl);
      return;
    }

    // Surface Bitbucket error details to help with debugging permission or naming issues.
    console.error('❌ Failed to trigger Bitbucket custom pipeline');
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

main();

