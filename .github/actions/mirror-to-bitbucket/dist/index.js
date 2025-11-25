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

// .github/actions/mirror-to-bitbucket/mirror.ts
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
async function main() {
  try {
    const pipelinesConfigured = fs.existsSync("bitbucket-pipelines.yml");
    setOutput("pipelines_configured", String(pipelinesConfigured));
    if (pipelinesConfigured) {
      console.log("\u2705 bitbucket-pipelines.yml found - pipelines are configured");
    } else {
      console.log("\u2139\uFE0F  bitbucket-pipelines.yml not found - skipping pipeline triggers");
      return;
    }
    const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME;
    const BITBUCKET_API_TOKEN = process.env.BITBUCKET_API_TOKEN;
    const BITBUCKET_REPO = process.env.BITBUCKET_REPO;
    let BRANCH_NAME = process.env.BRANCH_NAME;
    const currentCommit = process.env.COMMIT_SHA;
    if (!BITBUCKET_USERNAME || !BITBUCKET_API_TOKEN || !BITBUCKET_REPO || !currentCommit) {
      throw new Error("\u274C Missing required inputs: BITBUCKET_USERNAME, BITBUCKET_API_TOKEN, BITBUCKET_REPO, or COMMIT_SHA");
    }
    if (!BRANCH_NAME) {
      BRANCH_NAME = process.env.GITHUB_REF_NAME;
    }
    if (!BRANCH_NAME) {
      throw new Error("\u274C Could not determine branch name");
    }
    const [workspace, repoSlug] = BITBUCKET_REPO.split("/");
    console.log(`Triggering pipeline for branch: ${BRANCH_NAME}`);
    const payload = {
      target: {
        ref_type: "branch",
        type: "pipeline_ref_target",
        ref_name: BRANCH_NAME
      }
    };
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BITBUCKET_API_TOKEN}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.ok && data.uuid) {
      const uuid = data.uuid.replace(/[{}]/g, "");
      console.log(`\u2705 Pipeline triggered via API (UUID: ${uuid})`);
      setOutput("triggered_pipeline_uuid", uuid);
    } else {
      console.log("Retrying with commit hash trigger...");
      const commitPayload = {
        target: {
          commit: { hash: currentCommit },
          type: "pipeline_commit_target"
        }
      };
      const retryResponse = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BITBUCKET_API_TOKEN}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(commitPayload)
      });
      const retryData = await retryResponse.json();
      if (retryResponse.ok && retryData.uuid) {
        const uuid = retryData.uuid.replace(/[{}]/g, "");
        console.log(`\u2705 Pipeline triggered via API (UUID: ${uuid})`);
        setOutput("triggered_pipeline_uuid", uuid);
      } else {
        console.error("\u274C Failed to trigger pipeline via API");
        console.error(JSON.stringify(retryData, null, 2));
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
main();
