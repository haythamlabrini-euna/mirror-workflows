#!/usr/bin/env node
/**
 * Build script for all TypeScript actions
 * Builds all actions in parallel for faster compilation
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Define all actions to build
const actions = [
  {
    name: 'mirror-to-bitbucket',
    input: '.github/actions/mirror-to-bitbucket/mirror.ts',
    output: '.github/actions/mirror-to-bitbucket/dist/index.js'
  },
  {
    name: 'wait-for-bitbucket-pipeline',
    input: '.github/actions/wait-for-bitbucket-pipeline/wait.ts',
    output: '.github/actions/wait-for-bitbucket-pipeline/dist/index.js'
  }
];

console.log('🔨 Building all TypeScript actions in parallel...\n');

// Build all actions in parallel
const buildPromises = actions.map(action => {
  return new Promise((resolve, reject) => {
    const args = [
      action.input,
      '--bundle',
      '--platform=node',
      '--target=node20',
      `--outfile=${action.output}`
    ];
    
    const child = spawn('npx', ['esbuild', ...args], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${action.name} built successfully`);
        resolve();
      } else {
        console.error(`❌ Failed to build ${action.name}`);
        if (stderr) console.error(stderr);
        reject(new Error(`Build failed for ${action.name} with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Error building ${action.name}:`, error.message);
      reject(error);
    });
  });
});

// Wait for all builds to complete
Promise.all(buildPromises)
  .then(() => {
    console.log('\n✨ All actions built successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  });

