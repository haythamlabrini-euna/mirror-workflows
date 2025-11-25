import * as fs from 'fs';
import * as os from 'os';

// Helper to set GitHub Output
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
    // 0. Check if bitbucket-pipelines.yml exists
    const pipelinesConfigured = fs.existsSync('bitbucket-pipelines.yml');
    setOutput('pipelines_configured', String(pipelinesConfigured));
    if (pipelinesConfigured) {
      console.log('✅ bitbucket-pipelines.yml found - pipelines are configured');
    } else {
      console.log('ℹ️  bitbucket-pipelines.yml not found - skipping pipeline triggers');
      return; // Exit if pipelines are not configured
    }

    // Inputs
    const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME;
    const BITBUCKET_API_TOKEN = process.env.BITBUCKET_API_TOKEN;
    const BITBUCKET_REPO = process.env.BITBUCKET_REPO;
    let BRANCH_NAME = process.env.BRANCH_NAME;
    const currentCommit = process.env.COMMIT_SHA;

    if (!BITBUCKET_USERNAME || !BITBUCKET_API_TOKEN || !BITBUCKET_REPO || !currentCommit) {
      throw new Error('❌ Missing required inputs: BITBUCKET_USERNAME, BITBUCKET_API_TOKEN, BITBUCKET_REPO, or COMMIT_SHA');
    }

    // Determine branch name if not provided (fallback)
    if (!BRANCH_NAME) {
      BRANCH_NAME = process.env.GITHUB_REF_NAME;
    }
    if (!BRANCH_NAME) {
      throw new Error('❌ Could not determine branch name');
    }

    // Trigger pipeline via API
    const [workspace, repoSlug] = BITBUCKET_REPO.split('/');
    console.log(`Triggering pipeline for branch: ${BRANCH_NAME}`);

    const payload = {
      target: {
        ref_type: 'branch',
        type: 'pipeline_ref_target',
        ref_name: BRANCH_NAME
      }
    };

    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BITBUCKET_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data: any = await response.json();
    
    if (response.ok && data.uuid) {
       const uuid = data.uuid.replace(/[{}]/g, '');
       console.log(`✅ Pipeline triggered via API (UUID: ${uuid})`);
       setOutput('triggered_pipeline_uuid', uuid);
    } else {
       // Retry with commit hash
       console.log('Retrying with commit hash trigger...');
       const commitPayload = {
         target: {
           commit: { hash: currentCommit },
           type: 'pipeline_commit_target'
         }
       };
       
       const retryResponse = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${BITBUCKET_API_TOKEN}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(commitPayload)
       });
       
       const retryData: any = await retryResponse.json();
       if (retryResponse.ok && retryData.uuid) {
          const uuid = retryData.uuid.replace(/[{}]/g, '');
          console.log(`✅ Pipeline triggered via API (UUID: ${uuid})`);
          setOutput('triggered_pipeline_uuid', uuid);
       } else {
          console.error('❌ Failed to trigger pipeline via API');
          console.error(JSON.stringify(retryData, null, 2));
       }
    }

  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
