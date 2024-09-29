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

        const handlerPropertyNode = sourceFile
          ? findNodeInTree(
              sourceFile,
              (node) =>
                node.kind === SyntaxKind.PropertyAssignment &&
                node.getFirstToken()?.getText() === "handler" &&
                node.getStart() <= position &&
                node.getEnd() >= position,
              logger
            )
          : null;
        const node = handlerPropertyNode
          ?.getChildren()
          .find((node) => node.kind === SyntaxKind.StringLiteral);

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
  condition: (node: Node) => boolean,
  logger: (string: string) => void
) => {
  if (condition(node)) {
    return node;
  } else {
    let result: Node | undefined;
    for (let i = 0; result == null && i < node.getChildCount(); i++) {
      result = findNodeInTree(node.getChildAt(i), condition, logger);
    }
    return result;
  }
};

export = init;
