/* eslint-disable @typescript-eslint/no-var-requires */
const ts = require('typescript');
const fs = require('fs/promises');
const path = require('path');
const { resolvePathAliases, on } = require('./utils');
const DIST_PATH = path.join(__dirname, '..', 'dist');
const SRC_PATH = path.join(__dirname, '..', 'src');
function getTSConfig() {
  const configPath = ts.findConfigFile(path.join(__dirname, '..'), ts.sys.fileExists, 'tsconfig.json');
  const readConfigFileResult = ts.readConfigFile(configPath, ts.sys.readFile);
  if (readConfigFileResult.error) throw new Error(ts.formatDiagnostic(readConfigFileResult.error, formatHost));
  const convertResult = ts.convertCompilerOptionsFromJson(readConfigFileResult.config.compilerOptions, './');
  if (convertResult.errors && convertResult.errors.length > 0)
    throw new Error(ts.formatDiagnostics(convertResult.errors, formatHost));
  return convertResult.options;
}
async function compile() {
  await fs.rm(DIST_PATH, { recursive: true, force: true });
  const config = getTSConfig();
  const host = ts.createCompilerHost(config);
  on(
    host,
    'readFile',
    path => (lastFilePath = path),
    t => lastFilePath.endsWith('.ts') && resolvePathAliases(SRC_PATH, lastFilePath, t),
  );
  const program = ts.createProgram([path.join(SRC_PATH, 'index.ts')], config, host);
  const emitResult = program.emit();
  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n',
        )}`,
      );
    } else console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  });
  process.exit();
}

compile();
