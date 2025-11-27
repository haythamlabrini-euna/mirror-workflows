"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// .github/actions/wait-for-bitbucket-pipeline/wait.ts
var fs = __toESM(require("fs"), 1);
var os = __toESM(require("os"), 1);
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}${os.EOL}`);
  } else {
    console.log(`[OUTPUT] ${name}=${value}`);
  }
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  try {
    const BITBUCKET_API_TOKEN = process.env.BITBUCKET_API_TOKEN;
    const BITBUCKET_REPO = process.env.BITBUCKET_REPO;
    let COMMIT_SHA = process.env.COMMIT_SHA;
    const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "30", 10);
    const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || "60", 10);
    const EXPECTED_PIPELINE_UUID = process.env.EXPECTED_PIPELINE_UUID ? process.env.EXPECTED_PIPELINE_UUID.replace(/[{}]/g, "") : "";
    if (!BITBUCKET_API_TOKEN || !BITBUCKET_REPO) {
      throw new Error("\u274C Missing required inputs: BITBUCKET_API_TOKEN or BITBUCKET_REPO");
    }
    if (!COMMIT_SHA) {
      throw new Error("\u274C Missing required input: COMMIT_SHA");
    }
    const pipelinesConfigured = fs.existsSync("bitbucket-pipelines.yml");
    if (!pipelinesConfigured) {
      console.log("\u2139\uFE0F bitbucket-pipelines.yml not found - skipping pipeline wait");
      process.exit(0);
    }
    const [workspace, repoSlug] = BITBUCKET_REPO.split("/");
    let attempt = 0;
    let foundPipelineUuid = "";
    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/?pagelen=50&sort=-created_on&target.commit.hash=${COMMIT_SHA}`;
      const response = await fetch(apiUrl, {
        headers: {
          "Authorization": `Bearer ${BITBUCKET_API_TOKEN}`,
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        console.error(`Failed to fetch pipelines: ${response.status} ${response.statusText}`);
      } else {
        const data = await response.json();
        const values = data.values || [];
        let targetPipeline;
        if (EXPECTED_PIPELINE_UUID) {
          targetPipeline = values.find((p) => p.uuid.replace(/[{}]/g, "") === EXPECTED_PIPELINE_UUID);
        } else {
          targetPipeline = values[0];
        }
        if (targetPipeline) {
          const uuid = targetPipeline.uuid.replace(/[{}]/g, "");
          const state = targetPipeline.state?.name;
          const result = targetPipeline.state?.result?.name;
          foundPipelineUuid = uuid;
          const pipelineUrl = `https://bitbucket.org/${workspace}/${repoSlug}/addon/pipelines/home#!/results/${uuid}`;
          setOutput("pipeline_uuid", uuid);
          setOutput("pipeline_state", state);
          setOutput("pipeline_result", result);
          setOutput("pipeline_url", pipelineUrl);
          console.log(`Polling pipeline ${uuid}... State: ${state}`);
          if (state === "COMPLETED") {
            if (result === "SUCCESSFUL") {
              console.log("\u2705 Bitbucket pipeline succeeded");
              process.exit(0);
            } else {
              console.error(`\u274C Pipeline failed: ${result}`);
              const detailsRes = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/${targetPipeline.uuid}`, {
                headers: { "Authorization": `Bearer ${BITBUCKET_API_TOKEN}`, "Accept": "application/json" }
              });
              let errorMessage = `Pipeline failed. View details at: ${pipelineUrl}`;
              if (detailsRes.ok) {
                const details = await detailsRes.json();
                const failedSteps = (details.steps || []).filter((s) => s.state?.result?.name === "FAILED" || s.state?.result?.name === "STOPPED").map((s) => `Step: ${s.name || "unknown"}, State: ${s.state?.name}, Result: ${s.state?.result?.name}`);
                if (failedSteps.length > 0) {
                  errorMessage += `

Failed steps:
${failedSteps.join("\n")}`;
                }
              }
              setOutput("error_message", errorMessage);
              process.exit(1);
            }
          }
        } else {
          console.log(`No pipeline found yet for commit ${COMMIT_SHA}...`);
        }
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(POLL_INTERVAL * 1e3);
      }
    }
    console.error("\u274C Timed out waiting for Bitbucket pipeline");
    if (foundPipelineUuid) {
      const pipelineUrl = `https://bitbucket.org/${workspace}/${repoSlug}/addon/pipelines/home#!/results/${foundPipelineUuid}`;
      setOutput("pipeline_url", pipelineUrl);
    }
    process.exit(1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
main();
