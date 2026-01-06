import * as fs from 'fs';
import * as os from 'os';

/**
 * Wait for Bitbucket Pipeline by UUID
 * 
 * Polls the Bitbucket API to wait for a specific pipeline (identified by UUID)
 * to complete. Reports the final result (SUCCESSFUL, FAILED, etc.).
 * 
 * This action is used when you already have a pipeline UUID and want to wait
 * for its completion, unlike the commit-based wait action which finds pipelines
 * by commit SHA.
 */

// Helper to write GitHub Action outputs in a safe way.
function setOutput(name: string, value: string) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}${os.EOL}`);
  } else {
    // Fallback for local testing: print to console
    console.log(`[OUTPUT] ${name}=${value}`);
  }
}

// Helper for sleep/delay between polling attempts.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Clean UUID by removing curly braces if present.
function cleanUuid(uuid: string): string {
  return uuid.replace(/[{}]/g, '');
}

// Construct the Bitbucket pipeline URL for viewing in the dashboard.
function buildPipelineUrl(workspace: string, repoSlug: string, uuid: string): string {
  return `https://bitbucket.org/${workspace}/${repoSlug}/addon/pipelines/home#!/results/${uuid}`;
}

async function main() {
  try {
    // Read inputs from environment variables (set by action.yml).
    const BITBUCKET_API_TOKEN = process.env.BITBUCKET_API_TOKEN;
    const BITBUCKET_REPO = process.env.BITBUCKET_REPO;
    const PIPELINE_UUID = process.env.PIPELINE_UUID;
    const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '120', 10);
    const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '15', 10);

    // Validate required inputs early for fast failure with clear messages.
    if (!BITBUCKET_API_TOKEN) {
      throw new Error('❌ Missing required input: BITBUCKET_API_TOKEN');
    }
    if (!BITBUCKET_REPO) {
      throw new Error('❌ Missing required input: BITBUCKET_REPO');
    }
    if (!PIPELINE_UUID) {
      throw new Error('❌ Missing required input: PIPELINE_UUID');
    }

    // Parse workspace and repo slug from BITBUCKET_REPO.
    const [workspace, repoSlug] = BITBUCKET_REPO.split('/');
    if (!workspace || !repoSlug) {
      throw new Error('❌ BITBUCKET_REPO must be in the format "workspace/repo-slug"');
    }

    // Clean the UUID (remove curly braces if present).
    const cleanedUuid = cleanUuid(PIPELINE_UUID);
    const pipelineUrl = buildPipelineUrl(workspace, repoSlug, cleanedUuid);

    console.log(`Waiting for Bitbucket pipeline UUID: ${cleanedUuid}`);
    console.log(`🔗 Pipeline URL: ${pipelineUrl}`);
    console.log(`Poll interval: ${POLL_INTERVAL}s, Max attempts: ${MAX_ATTEMPTS}`);

    // Set the pipeline URL output immediately so it's available even if we timeout.
    setOutput('pipeline_url', pipelineUrl);

    let attempt = 0;

    // Main polling loop: check pipeline status until complete or timeout.
    while (attempt < MAX_ATTEMPTS) {
      attempt++;

      // Fetch pipeline status by UUID from Bitbucket API.
      const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/{${cleanedUuid}}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${BITBUCKET_API_TOKEN}`,
          'Accept': 'application/json'
        }
      });

      // Check for API errors (e.g., pipeline not found, auth issues).
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        
        // Check if this is a "not found" error (pipeline may not be ready yet).
        if (response.status === 404) {
          console.log(`⚠️ Attempt ${attempt}/${MAX_ATTEMPTS}: Pipeline not found yet, waiting...`);
          if (attempt < MAX_ATTEMPTS) {
            await sleep(POLL_INTERVAL * 1000);
          }
          continue;
        }
        
        // For other errors, log and continue polling.
        console.error(`⚠️ Attempt ${attempt}/${MAX_ATTEMPTS}: API error (${response.status}): ${errorBody}`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(POLL_INTERVAL * 1000);
        }
        continue;
      }

      const data: any = await response.json();

      // Extract pipeline state and result from response.
      const state = data.state?.name || '';
      const result = data.state?.result?.name || '';

      console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}: State=${state}, Result=${result}`);

      // Set outputs for state and result.
      setOutput('pipeline_state', state);
      if (result) {
        setOutput('pipeline_result', result);
      }

      // Check if pipeline is complete.
      if (state === 'COMPLETED') {
        if (result === 'SUCCESSFUL') {
          console.log('✅ Pipeline completed successfully');
          process.exit(0);
        } else {
          // Pipeline failed or stopped.
          console.error(`❌ Pipeline completed with result: ${result}`);
          process.exit(1);
        }
      }

      // Wait before next poll if not at max attempts.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(POLL_INTERVAL * 1000);
      }
    }

    // Timeout: reached max attempts without completion.
    console.error(`❌ Timed out waiting for Bitbucket pipeline after ${MAX_ATTEMPTS} attempts`);
    setOutput('pipeline_result', 'TIMEOUT');
    process.exit(1);

  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

main();

