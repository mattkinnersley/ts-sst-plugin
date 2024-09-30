import typescript, {
  Node,
  ScriptElementKind,
  SyntaxKind,
} from "typescript/lib/typescript";
import path from "path";
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
        throw new Error();
      }
      return program;
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

        const node = sourceFile
          ? findTargetNode(sourceFile, position, logger)
          : null;

        if (!node) {
          logger(`No handler string found`);
          return original;
        } else {
          const [start, end] = node.getText().split(".");
          const definitionFilename = `${start.replace(`"`, "")}.ts`;
          const handlerName = end.replace(`"`, "");
          const definitionFilePath = `${projectDir}/${definitionFilename}`;
          const definitionSourceFile =
            getProgram().getSourceFile(definitionFilePath);
          if (!definitionSourceFile) {
            logger(`No source file found for ${definitionFilePath}`);
            return original;
          }
          logger(`Found source file for ${definitionFilePath}`);
          return {
            textSpan: {
              start: node.getStart(),
              length: node.getWidth(),
            },
            definitions: [
              {
                fileName: definitionSourceFile.fileName,
                textSpan: {
                  start: definitionSourceFile.getStart(),
                  length: definitionSourceFile.getWidth(),
                },
                kind: ScriptElementKind.moduleElement,
                name: handlerName,
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
  conditions: { fn: (node: Node) => boolean; key: string }[],
  logger: (string: string) => void
) => {
  let key = null;
  for (let i = 0; key == null && i < conditions.length; i++) {
    const condition = conditions[i];
    if (condition.fn(node)) {
      key = condition.key;
    }
  }
  if (key) {
    const children = node.getChildren();
    logger(`found ${key} with child count: ${children.length}`);
    for (let i = 0; i < children.length; i++) {
      logger(
        `child ${i} of kind ${SyntaxKind[children[i].kind]}: ${children[
          i
        ].getFullText()}`
      );
    }

    logger(`grandparents kind: ${SyntaxKind[node.parent?.parent.kind]}`);
    logger(`parents kind: ${SyntaxKind[node.parent?.kind]}`);
    const parentsChildren = node.parent.getChildren();
    for (let i = 0; i < parentsChildren.length; i++) {
      logger(
        `parent child ${i} of kind ${
          SyntaxKind[parentsChildren[i].kind]
        }: ${parentsChildren[i].getFullText()}`
      );
    }

    logger("parent child 0: " + node.parent.getChildAt(0).getFullText());

    logger("this kind: " + SyntaxKind[node.kind]);
    logger("this text: " + node.getText());

    return { node, key };
  } else {
    let result: { node: Node; key: string } | undefined;
    for (let i = 0; result == null && i < node.getChildCount(); i++) {
      result = findNodeInTree(node.getChildAt(i), conditions, logger);
    }
    return result;
  }
};

const findTargetNode = (
  sourceFile: Node,
  position: number,
  logger: (string: string) => void
) => {
  const result = sourceFile
    ? findNodeInTree(
        sourceFile,
        [
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
              node.parent.getChildAt(0).kind ===
                SyntaxKind.PropertyAccessExpression &&
              node.parent.getChildAt(0).getFullText().includes(".subscribe") &&
              node.getStart() <= position &&
              node.getEnd() >= position,
            key: "dynamoSubscription",
          },
        ],
        logger
      )
    : null;

  return result?.node;
};

export = init;
