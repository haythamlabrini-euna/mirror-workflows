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

// Helper for sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  try {
    // Inputs
    const BITBUCKET_API_TOKEN = process.env.BITBUCKET_API_TOKEN;
    const BITBUCKET_REPO = process.env.BITBUCKET_REPO;
    let COMMIT_SHA = process.env.COMMIT_SHA;
    const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30', 10);
    const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '60', 10);
    const EXPECTED_PIPELINE_UUID = process.env.EXPECTED_PIPELINE_UUID ? process.env.EXPECTED_PIPELINE_UUID.replace(/[{}]/g, '') : '';

    if (!BITBUCKET_API_TOKEN || !BITBUCKET_REPO) {
      throw new Error('❌ Missing required inputs: BITBUCKET_API_TOKEN or BITBUCKET_REPO');
    }

    if (!COMMIT_SHA) {
       throw new Error('❌ Missing required input: COMMIT_SHA');
    }

    // Check if bitbucket-pipelines.yml exists in the repository
    // If it doesn't exist, skip waiting and return success immediately
    // This prevents unnecessary API calls when pipelines aren't configured
    const pipelinesConfigured = fs.existsSync('bitbucket-pipelines.yml');
    if (!pipelinesConfigured) {
      console.log('ℹ️ bitbucket-pipelines.yml not found - skipping pipeline wait');
      process.exit(0);
    }

    const [workspace, repoSlug] = BITBUCKET_REPO.split('/');
    let attempt = 0;
    let foundPipelineUuid = '';

    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      
      const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/?pagelen=50&sort=-created_on&target.commit.hash=${COMMIT_SHA}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${BITBUCKET_API_TOKEN}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
         console.error(`Failed to fetch pipelines: ${response.status} ${response.statusText}`);
      } else {
        const data: any = await response.json();
        const values = data.values || [];
        
        let targetPipeline;
        if (EXPECTED_PIPELINE_UUID) {
           targetPipeline = values.find((p: any) => p.uuid.replace(/[{}]/g, '') === EXPECTED_PIPELINE_UUID);
        } else {
           targetPipeline = values[0];
        }

        if (targetPipeline) {
          const uuid = targetPipeline.uuid.replace(/[{}]/g, '');
          const state = targetPipeline.state?.name;
          const result = targetPipeline.state?.result?.name;
          foundPipelineUuid = uuid;
          
          const pipelineUrl = `https://bitbucket.org/${workspace}/${repoSlug}/addon/pipelines/home#!/results/${uuid}`;
          
          setOutput('pipeline_uuid', uuid);
          setOutput('pipeline_state', state);
          setOutput('pipeline_result', result);
          setOutput('pipeline_url', pipelineUrl);
          
          console.log(`Polling pipeline ${uuid}... State: ${state}`);
          
          if (state === 'COMPLETED') {
            if (result === 'SUCCESSFUL') {
              console.log('✅ Bitbucket pipeline succeeded');
              process.exit(0);
            } else {
              // Failed
              console.error(`❌ Pipeline failed: ${result}`);
              
              // Fetch details for error message
              const detailsRes = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/${targetPipeline.uuid}`, {
                  headers: { 'Authorization': `Bearer ${BITBUCKET_API_TOKEN}`, 'Accept': 'application/json' }
              });
              
              let errorMessage = `Pipeline failed. View details at: ${pipelineUrl}`;
              
              if (detailsRes.ok) {
                 const details: any = await detailsRes.json();
                 const failedSteps = (details.steps || [])
                    .filter((s: any) => s.state?.result?.name === 'FAILED' || s.state?.result?.name === 'STOPPED')
                    .map((s: any) => `Step: ${s.name || 'unknown'}, State: ${s.state?.name}, Result: ${s.state?.result?.name}`);
                 
                 if (failedSteps.length > 0) {
                    errorMessage += `\n\nFailed steps:\n${failedSteps.join('\n')}`;
                 }
              }
              
              setOutput('error_message', errorMessage);
              process.exit(1);
            }
          }
        } else {
           console.log(`No pipeline found yet for commit ${COMMIT_SHA}...`);
        }
      }

      if (attempt < MAX_ATTEMPTS) {
        await sleep(POLL_INTERVAL * 1000);
      }
    }

    console.error('❌ Timed out waiting for Bitbucket pipeline');
    if (foundPipelineUuid) {
       const pipelineUrl = `https://bitbucket.org/${workspace}/${repoSlug}/addon/pipelines/home#!/results/${foundPipelineUuid}`;
       setOutput('pipeline_url', pipelineUrl);
    }
    process.exit(1);

  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

main();

