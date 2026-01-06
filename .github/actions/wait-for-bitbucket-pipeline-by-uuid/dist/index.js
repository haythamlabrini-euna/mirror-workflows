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

// .github/actions/wait-for-bitbucket-pipeline-by-uuid/wait-by-uuid.ts
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
function cleanUuid(uuid) {
  return uuid.replace(/[{}]/g, "");
}
function buildPipelineUrl(workspace, repoSlug, uuid) {
  return `https://bitbucket.org/${workspace}/${repoSlug}/addon/pipelines/home#!/results/${uuid}`;
}
async function main() {
  try {
    const BITBUCKET_API_TOKEN = process.env.BITBUCKET_API_TOKEN;
    const BITBUCKET_REPO = process.env.BITBUCKET_REPO;
    const PIPELINE_UUID = process.env.PIPELINE_UUID;
    const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "120", 10);
    const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || "15", 10);
    if (!BITBUCKET_API_TOKEN) {
      throw new Error("\u274C Missing required input: BITBUCKET_API_TOKEN");
    }
    if (!BITBUCKET_REPO) {
      throw new Error("\u274C Missing required input: BITBUCKET_REPO");
    }
    if (!PIPELINE_UUID) {
      throw new Error("\u274C Missing required input: PIPELINE_UUID");
    }
    const [workspace, repoSlug] = BITBUCKET_REPO.split("/");
    if (!workspace || !repoSlug) {
      throw new Error('\u274C BITBUCKET_REPO must be in the format "workspace/repo-slug"');
    }
    const cleanedUuid = cleanUuid(PIPELINE_UUID);
    const pipelineUrl = buildPipelineUrl(workspace, repoSlug, cleanedUuid);
    console.log(`Waiting for Bitbucket pipeline UUID: ${cleanedUuid}`);
    console.log(`\u{1F517} Pipeline URL: ${pipelineUrl}`);
    console.log(`Poll interval: ${POLL_INTERVAL}s, Max attempts: ${MAX_ATTEMPTS}`);
    setOutput("pipeline_url", pipelineUrl);
    let attempt = 0;
    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/{${cleanedUuid}}`;
      const response = await fetch(apiUrl, {
        headers: {
          "Authorization": `Bearer ${BITBUCKET_API_TOKEN}`,
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        if (response.status === 404) {
          console.log(`\u26A0\uFE0F Attempt ${attempt}/${MAX_ATTEMPTS}: Pipeline not found yet, waiting...`);
          if (attempt < MAX_ATTEMPTS) {
            await sleep(POLL_INTERVAL * 1e3);
          }
          continue;
        }
        console.error(`\u26A0\uFE0F Attempt ${attempt}/${MAX_ATTEMPTS}: API error (${response.status}): ${errorBody}`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(POLL_INTERVAL * 1e3);
        }
        continue;
      }
      const data = await response.json();
      const state = data.state?.name || "";
      const result = data.state?.result?.name || "";
      console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}: State=${state}, Result=${result}`);
      setOutput("pipeline_state", state);
      if (result) {
        setOutput("pipeline_result", result);
      }
      if (state === "COMPLETED") {
        if (result === "SUCCESSFUL") {
          console.log("\u2705 Pipeline completed successfully");
          process.exit(0);
        } else {
          console.error(`\u274C Pipeline completed with result: ${result}`);
          process.exit(1);
        }
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(POLL_INTERVAL * 1e3);
      }
    }
    console.error(`\u274C Timed out waiting for Bitbucket pipeline after ${MAX_ATTEMPTS} attempts`);
    setOutput("pipeline_result", "TIMEOUT");
    process.exit(1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
main();
