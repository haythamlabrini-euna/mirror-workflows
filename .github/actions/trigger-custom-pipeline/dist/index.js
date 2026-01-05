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

// .github/actions/trigger-custom-pipeline/trigger-custom-pipeline.ts
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
    const BITBUCKET_API_TOKEN = process.env.BITBUCKET_API_TOKEN;
    const BITBUCKET_REPO = process.env.BITBUCKET_REPO;
    const PIPELINE_NAME = process.env.PIPELINE_NAME;
    const BRANCH_NAME = process.env.BRANCH_NAME || "main";
    if (!BITBUCKET_API_TOKEN || !BITBUCKET_REPO || !PIPELINE_NAME) {
      throw new Error("\u274C Missing required inputs: BITBUCKET_API_TOKEN, BITBUCKET_REPO, or PIPELINE_NAME");
    }
    const [workspace, repoSlug] = BITBUCKET_REPO.split("/");
    if (!workspace || !repoSlug) {
      throw new Error('\u274C BITBUCKET_REPO must be in the format "workspace/repo-slug"');
    }
    const payload = {
      target: {
        type: "pipeline_ref_target",
        ref_type: "branch",
        ref_name: BRANCH_NAME,
        selector: {
          type: "custom",
          pattern: PIPELINE_NAME
        }
      }
    };
    console.log(`Triggering Bitbucket custom pipeline '${PIPELINE_NAME}' on branch '${BRANCH_NAME}'`);
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BITBUCKET_API_TOKEN}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.uuid) {
      const uuid = data.uuid.replace(/[{}]/g, "");
      const pipelineUrl = `https://bitbucket.org/${workspace}/${repoSlug}/addon/pipelines/home#!/results/${uuid}`;
      console.log(`\u2705 Custom pipeline triggered (UUID: ${uuid})`);
      console.log(`\u{1F517} Pipeline URL: ${pipelineUrl}`);
      setOutput("triggered_pipeline_uuid", uuid);
      setOutput("pipeline_url", pipelineUrl);
      return;
    }
    console.error("\u274C Failed to trigger Bitbucket custom pipeline");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
main();
