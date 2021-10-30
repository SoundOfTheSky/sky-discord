/* eslint-disable @typescript-eslint/no-var-requires */
const ts = require('typescript');
const { spawn } = require('child_process');
const path = require('path');
const { resolvePathAliases, on } = require('./utils');
const DIST_PATH = path.join(__dirname, '..', 'dist');
const SRC_PATH = path.join(__dirname, '..', 'src');
const formatHost = {
  getCanonicalFileName: path => path,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

function watch() {
  const host = ts.createWatchCompilerHost(
    ts.findConfigFile(path.join(__dirname, '..'), ts.sys.fileExists, 'tsconfig.json'),
    {},
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    diagnostic => console.log(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatHost)),
    diagnostic => console.log(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatHost)),
  );
  let nodeProcess;
  let startTimeout;
  let lastFilePath;
  on(
    host,
    'readFile',
    path => (lastFilePath = path),
    t => lastFilePath.endsWith('.ts') && resolvePathAliases(SRC_PATH, lastFilePath, t),
  );
  on(host, 'afterProgramCreate', undefined, async () => {
    clearTimeout(startTimeout);
    if (nodeProcess) {
      process.kill(nodeProcess.pid);
      nodeProcess = null;
    }
    startTimeout = setTimeout(() => {
      nodeProcess = spawn('node', [DIST_PATH]);
      nodeProcess.on('exit', async code => {
        console.log(`Backend exited with code ${code}`);
        nodeProcess = null;
      });
      nodeProcess.stdout.pipe(process.stdout);
      nodeProcess.stderr.pipe(process.stderr);
    }, 500);
  });
  ts.createWatchProgram(host);
}

watch();
