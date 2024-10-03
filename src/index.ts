import typescript, {
  createSourceFile,
  Diagnostic,
  DiagnosticCategory,
  Node,
  Program,
  ScriptElementKind,
  ScriptTarget,
  SourceFile,
  SyntaxKind,
} from "typescript/lib/typescript";
import path from "path";
import { existsSync, readFileSync } from "fs";

type ResultKey = "functionHandler" | "packagePath" | "dynamoSubscription";

function init() {
  function create(info: typescript.server.PluginCreateInfo) {
    const logger = (string: string) => {
      info.project.projectService.logger.info(`[ts-sst-plugin] ${string}`);
    };
    // Diagnostic logging
    logger("I'm getting set up now! Check the log for this message.");

    // Set up decorator object
    const proxy: typescript.LanguageService = Object.create(null);
    for (let k of Object.keys(info.languageService) as Array<
      keyof typescript.LanguageService
    >) {
      const x = info.languageService[k]!;
      // @ts-expect-error - JS runtime trickery which is tricky to type tersely
      proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
    }

    const getProgram = () => {
      const program = info.languageService.getProgram();
      if (!program) {
        throw new Error("Could not get program");
      }
      return program;
    };

    proxy.getCompletionsAtPosition = (fileName, position, options) => {
      logger("getCompletionsAtPosition");
      const original = info.languageService.getCompletionsAtPosition(
        fileName,
        position,
        options
      );
      // logger(`Original completions length: ${original?.entries.length}`);
      // logger(
      //   `Original ${
      //     original?.isGlobalCompletion ? "global" : "local"
      //   } completion`
      // );
      // logger(`Original ${original?.isIncomplete}`);
      // logger(
      //   `Original ${
      //     original?.isMemberCompletion ? "member" : "non-member"
      //   } completion`
      // );
      // logger(
      //   `Original ${
      //     original?.isNewIdentifierLocation
      //       ? "new identifier"
      //       : "not new identifier"
      //   } location`
      // );
      // logger(`Original completions: ${original?.entries.map((e) => e.name)}`);
      // logger(`Original[0] name: ${original?.entries[0]?.name}`);
      // logger(`Original[0] kind: ${original?.entries[0]?.kind}`);
      // logger(
      //   `Original[0] kindModifiers: ${original?.entries[0]?.kindModifiers}`
      // );
      // logger(`Original[0] sortText: ${original?.entries[0]?.sortText}`);
      // logger(`Original[0] source: ${original?.entries[0]?.source}`);
      // logger(`Original[0] hasAction: ${original?.entries[0]?.hasAction}`);
      // logger(`Original[0] insertText: ${original?.entries[0]?.insertText}`);
      // logger(
      //   `Original[0] replacementSpan: ${original?.entries[0]?.replacementSpan}`
      // );
      // logger(
      //   `Original[0] isRecommended: ${original?.entries[0]?.isRecommended}`
      // );
      // logger(
      //   `Original[0] isFromUncheckedFile: ${original?.entries[0]?.isFromUncheckedFile}`
      // );
      // logger(
      //   `Original[0] isPackageJsonImport: ${original?.entries[0]?.isPackageJsonImport}`
      // );
      // logger(
      //   `Original[0] commitCharacters: ${original?.entries[0]?.commitCharacters}`
      // );
      // logger(`Original[0] data: ${original?.entries[0]?.data}`);
      // logger(
      //   `Original[0] sourceDisplay: ${original?.entries[0]?.sourceDisplay}`
      // );
      // logger(`Original[0] isSnippet: ${original?.entries[0]?.isSnippet}`);
      // logger(`Original[0] filterText: ${original?.entries[0]?.filterText}`);
      // logger(
      //   `Original[0] labelDetails description: ${original?.entries[0]?.labelDetails?.description}`
      // );
      // logger(
      //   `Original[0] labelDetails detail: ${original?.entries[0]?.labelDetails?.detail}`
      // );
      return original;
    };

    proxy.getSemanticDiagnostics = (fileName) => {
      logger("getSemanticDiagnostics");
      const original = info.languageService.getSemanticDiagnostics(fileName);
      const { project } = info;

      const projectDir = path.dirname(project.getProjectName());
      try {
        const sourceFile = getProgram().getSourceFile(fileName);
        if (!sourceFile) {
          return original;
        }

        const results = findTargetNodes(sourceFile);
        if (!results?.length) {
          return original;
        }

        let customDiagnostics: Diagnostic[] = [];
        results.forEach((result) => {
          logger(`Found ${result.key}: ${result.node.getText()}`);
          const { definitionSourceFile, definitionFilePath } =
            getDefinitionFromResult(result, projectDir, getProgram);
          if (!definitionSourceFile) {
            const category =
              Number(info.config.rules?.["check-paths"]) > -1 &&
              Number(info.config.rules?.["check-paths"]) < 4
                ? Number(info.config.rules?.["check-paths"])
                : DiagnosticCategory.Error;

            customDiagnostics.push({
              start: result.node.getStart(),
              code: 557,
              category: category,
              messageText: `Cannot find file ${definitionFilePath}`,
              source: "ts-sst-plugin",
              file: sourceFile,
              length: result.node.getWidth(),
            });
          }
        });

        const diagnostics = [...original, ...customDiagnostics];
        return diagnostics;
      } catch (error: any) {
        logger(error.message ? error.message : "unknown error");
        return original;
      }
    };

    // Remove specified entries from completion list
    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
      logger("getDefinitionAndBoundSpan");
      const original = info.languageService.getDefinitionAndBoundSpan(
        fileName,
        position
      );
      const { project } = info;

      const projectDir = path.dirname(project.getProjectName());

      try {
        const sourceFile = getProgram().getSourceFile(fileName);

        const result = sourceFile ? findTargetNode(sourceFile, position) : null;

        if (!result?.node) {
          logger(`No target node found`);
          return original;
        } else {
          const { definitionSourceFile, definitionName, definitionFilePath } =
            getDefinitionFromResult(result, projectDir, getProgram);
          if (!definitionSourceFile) {
            logger(`No source file found for ${definitionFilePath}`);
            return original;
          }
          return {
            textSpan: {
              start: result.node.getStart(),
              length: result.node.getWidth(),
            },
            definitions: [
              {
                fileName: definitionSourceFile.fileName,
                textSpan: {
                  start: definitionSourceFile.getStart(),
                  length: definitionSourceFile.getWidth(),
                },
                kind: ScriptElementKind.moduleElement,
                name: definitionName || definitionSourceFile.fileName,
                containerName: `"${definitionFilePath}"`,
                contextSpan: {
                  start: definitionSourceFile.getStart(),
                  length: definitionSourceFile.getWidth(),
                },
                containerKind: ScriptElementKind.moduleElement,
              },
            ],
          };
        }
      } catch (error: any) {
        logger(error.message ? error.message : "unknown error");
        return original;
      }
    };

    return proxy;
  }

  return { create };
}

const findNodeInTree = (
  node: Node,
  conditions: { fn: (node: Node) => boolean; key: ResultKey }[]
) => {
  let key = null;
  for (let i = 0; key == null && i < conditions.length; i++) {
    const condition = conditions[i];
    if (condition.fn(node)) {
      key = condition.key;
    }
  }
  if (key) {
    return { node, key };
  } else {
    let result: { node: Node; key: ResultKey } | undefined;
    for (let i = 0; result == null && i < node.getChildCount(); i++) {
      result = findNodeInTree(node.getChildAt(i), conditions);
    }
    return result;
  }
};

const findTargetNode = (sourceFile: Node, position: number) => {
  const result = sourceFile
    ? findNodeInTree(sourceFile, [
        {
          fn: (node) =>
            node.kind === SyntaxKind.StringLiteral &&
            node.parent.kind === SyntaxKind.PropertyAssignment &&
            node.parent.getFirstToken()?.getText() === "handler" &&
            node.getStart() <= position &&
            node.getEnd() >= position,
          key: "functionHandler",
        },
        {
          fn: (node) =>
            node.kind === SyntaxKind.StringLiteral &&
            node.parent.kind === SyntaxKind.PropertyAssignment &&
            node.parent.getFirstToken()?.getText() === "path" &&
            node.getStart() <= position &&
            node.getEnd() >= position,
          key: "packagePath",
        },
        {
          fn: (node) =>
            node.kind === SyntaxKind.StringLiteral &&
            node.parent.getChildAt(0).kind ===
              SyntaxKind.PropertyAccessExpression &&
            node.parent.getChildAt(0).getFullText().includes(".subscribe") &&
            node.getStart() <= position &&
            node.getEnd() >= position,
          key: "dynamoSubscription",
        },
      ])
    : null;

  return result;
};

const findNodesInTree = (
  node: Node,
  conditions: { fn: (node: Node) => boolean; key: ResultKey }[],
  results: { node: Node; key: ResultKey }[]
) => {
  let key = null;
  for (let i = 0; key == null && i < conditions.length; i++) {
    const condition = conditions[i];
    if (condition.fn(node)) {
      key = condition.key;
    }
  }
  if (key) {
    results.push({ node, key });
  } else {
    for (let i = 0; i < node.getChildCount(); i++) {
      findNodesInTree(node.getChildAt(i), conditions, results);
    }
    return results;
  }
};

const findTargetNodes = (sourceFile: Node) => {
  const result = sourceFile
    ? findNodesInTree(
        sourceFile,
        [
          {
            fn: (node) =>
              node.kind === SyntaxKind.StringLiteral &&
              node.parent.kind === SyntaxKind.PropertyAssignment &&
              node.parent.getFirstToken()?.getText() === "handler",
            key: "functionHandler",
          },
          {
            fn: (node) =>
              node.kind === SyntaxKind.StringLiteral &&
              node.parent.kind === SyntaxKind.PropertyAssignment &&
              node.parent.getFirstToken()?.getText() === "path",
            key: "packagePath",
          },
          {
            fn: (node) =>
              node.kind === SyntaxKind.StringLiteral &&
              node.parent.getChildAt(0).kind ===
                SyntaxKind.PropertyAccessExpression &&
              node.parent.getChildAt(0).getFullText().includes(".subscribe"),
            key: "dynamoSubscription",
          },
        ],
        []
      )
    : null;

  return result;
};

const getDefinitionFromResult = (
  result: { node: Node; key: ResultKey },
  projectDir: string,
  getProgram: () => Program
) => {
  let definitionFilePath = null;
  let definitionName = null;
  let definitionSourceFile: SourceFile | undefined;
  const path = result.node.getText().replaceAll(`"`, "");
  if (result.key === "dynamoSubscription" || result.key === "functionHandler") {
    const dotIndex = path.lastIndexOf(".");
    const definitionFilename = path.substring(0, dotIndex);
    definitionName = path.substring(dotIndex + 1);
    definitionFilePath = `${projectDir}/${definitionFilename}.ts`;
    definitionSourceFile = getProgram().getSourceFile(definitionFilePath);
    if (!definitionSourceFile) {
      definitionFilePath = `${projectDir}/${definitionFilename}.js`;
      definitionSourceFile = getProgram().getSourceFile(definitionFilePath);
    }
  }
  if (result.key === "packagePath") {
    definitionFilePath = `${projectDir}/${path}/package.json`;
    definitionName = "package.json";
    if (existsSync(definitionFilePath)) {
      definitionSourceFile = createSourceFile(
        definitionFilePath,
        readFileSync(definitionFilePath).toString(),
        ScriptTarget.JSON
      );
    }
  }
  return { definitionSourceFile, definitionName, definitionFilePath };
};

export = init;
