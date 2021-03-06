import { createMacro } from 'babel-plugin-macros';
import { parse } from '@babel/parser';
// not using since not sure if babel.types is the very same babel.types or a different version
// import * as t from '@babel/types';
import * as babelTypes from '@babel/types';
import { getFunctionName, isExposedStatement, isTypeScriptGeneratedExport } from './common';
import { readFileSync } from 'fs';
import path from 'path';

interface MacrosPluginPass {
  filename: string;
  cwd: string;
  opts: object;
  file: {
    ast: babelTypes.File,
    opts: {
      root: string,
      filename: string,
    },
  };
  key: 'macros';
}

interface MacrosBabel {
  types: typeof babelTypes;
}

function assertExportedMember(ast: babelTypes.File, t: typeof babelTypes, funcName: string): void {
  // This function is looking for this line in the file
  // exports.funcName = funcName
  // we support this because this is the TypeScript's generated pattern for named exports
  const { body } = ast.program;
  const isFunctionExported = body.some((e) => isTypeScriptGeneratedExport(e, t, funcName));
  if (!isFunctionExported) {
    throw new Error(`${funcName} has @expose decorator but it is not exported`);
  }
}

function findExportedMethods(ast: babelTypes.File, { types: t }: MacrosBabel, importedNames: string[]): string[] {
  const { body } = ast.program;
  // support ExportDefaultDeclaration (ExportAllDeclaration too for re-exporting ?)
  const exposedStatements = body.filter(isExposedStatement);
  return exposedStatements.reduce((ret: string[], e) => {
    if (t.isFunctionDeclaration(e)) {
      const funcName = getFunctionName(e, t);
      if (funcName && importedNames.includes(funcName)) {
        assertExportedMember(ast, t, funcName);
        ret.push(funcName);
      }
    } else if (t.isExportNamedDeclaration(e) && t.isFunctionDeclaration(e.declaration)) {
      const funcName = getFunctionName(e.declaration, t);
      if (funcName) {
        ret.push(funcName);
      }
    }
    return ret;
  }, []);
}

function exposeMacro({ state, babel }: { state: MacrosPluginPass, babel: MacrosBabel }) {
  // not using passed references from arguments since doing whole file pass
  interface ExposeReplacement {
    idx: number;
    names: string[];
    methods: string[];
    importedPath: string;
  }
  const t: typeof babelTypes = babel.types;
  const file: babelTypes.File = state.file.ast;
  const { body } = file.program;
  const found: ExposeReplacement[] = [];
  body.forEach((node, idx) => {
    if (t.isImportDeclaration(node)) {
      // skip absolute paths (modules)
      if (!node.source.value.startsWith('.')) {
        return;
      }
      if (!node.specifiers.length) {
        return;
      }
      // support ImportDefaultSpecifier (together with default export in the future)
      if (node.specifiers.some((specifier) => t.isImportDefaultSpecifier(specifier))) {
        return;
      }
      const names = node.specifiers.map((specifier) => specifier.local.name);
      const dir = path.dirname(state.filename);
      const importedFile = path.join(dir, node.source.value);
      const backendRoot = path.join(state.file.opts.root, 'backend');
      const relative = path.relative(backendRoot, importedFile);
      const isSubPath = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
      if (isSubPath) {
        let resolvedImportedPath: string;
        let content: string;
        try {
          resolvedImportedPath = require.resolve(importedFile);
          content = readFileSync(resolvedImportedPath, 'utf8');
        } catch (err) {
          throw new Error(`File ${node.source.value} could not be read ${err}`);
          // handle this error somehow
        }
        let importedFileAst: babelTypes.File;
        try {
          importedFileAst = parse(content, { sourceType: 'module' });
        } catch (err) {
          throw new Error(`File ${resolvedImportedPath} parse error ${err}`);
        }
        const methods = findExportedMethods(importedFileAst, babel, names);
        const namesSet = new Set(names);
        const methodsSet = new Set(methods);
        const difference = [...namesSet].filter((name) => !methodsSet.has(name));
        if (difference.length) {
          throw new Error(`"${difference}" is missing from "${node.source.value}", did you forget to @expose ?`);
        }
        found.push({ idx, names, methods, importedPath: path.relative(backendRoot, resolvedImportedPath) });
      }
    }
  });
  if (found.length) {
    found.forEach(({ names, idx, methods, importedPath }, loopIdx) => {
      // Only insert runtime on first loop
      if (loopIdx === 0) {
        body.splice(idx, 0,
          t.importDeclaration(
            [t.importSpecifier(t.identifier('createRuntime'), t.identifier('createRuntime'))],
            t.stringLiteral('@reshuffle/fetch-runtime'),
          ),
        );
      }
      // all previously computed indices need to be shifted by 1 due to createRuntime import
      body.splice(idx + 1, 1,
        t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              t.objectPattern(names.map((name) => t.objectProperty(
                t.identifier(name),
                t.identifier(name),
                false,
                true,
              ))),
              /*
               * WARNING
               * Do not change the following call expression without changing the signature in
               * fetch-runtime/src/index.ts
               */
              t.callExpression(t.identifier('createRuntime'), [
                t.arrayExpression(methods.map((m) => t.stringLiteral(m))),
                t.objectExpression([
                  t.objectProperty(t.stringLiteral('filename'), t.stringLiteral(importedPath)),
                ]),
              ])
            ),
          ]
        ),
      );
    });
  }
}

module.exports = createMacro(exposeMacro);
