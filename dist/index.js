"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const typescript_1 = require("typescript/lib/typescript");
const path_1 = __importDefault(require("path"));
function init() {
    function create(info) {
        const logger = (string) => {
            info.project.projectService.logger.info(`[ts-sst-plugin] ${string}`);
        };
        // Diagnostic logging
        logger("I'm getting set up now! Check the log for this message.");
        // Set up decorator object
        const proxy = Object.create(null);
        for (let k of Object.keys(info.languageService)) {
            const x = info.languageService[k];
            // @ts-expect-error - JS runtime trickery which is tricky to type tersely
            proxy[k] = (...args) => x.apply(info.languageService, args);
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
            const original = info.languageService.getDefinitionAndBoundSpan(fileName, position);
            const { project } = info;
            const projectDir = path_1.default.dirname(project.getProjectName());
            try {
                const sourceFile = getProgram().getSourceFile(fileName);
                const handlerPropertyNode = sourceFile
                    ? findNodeInTree(sourceFile, (node) => {
                        var _a;
                        return node.kind === typescript_1.SyntaxKind.PropertyAssignment &&
                            ((_a = node.getFirstToken()) === null || _a === void 0 ? void 0 : _a.getText()) === "handler" &&
                            node.getStart() <= position &&
                            node.getEnd() >= position;
                    }, logger)
                    : null;
                const node = handlerPropertyNode === null || handlerPropertyNode === void 0 ? void 0 : handlerPropertyNode.getChildren().find((node) => node.kind === typescript_1.SyntaxKind.StringLiteral);
                if (!node) {
                    logger(`No handler string found`);
                    return original;
                }
                else {
                    const [start, end] = node.getText().split(".");
                    const definitionFilename = `${start.replace(`"`, "")}.ts`;
                    const handlerName = end.replace(`"`, "");
                    const definitionFilePath = `${projectDir}/${definitionFilename}`;
                    const definitionSourceFile = getProgram().getSourceFile(definitionFilePath);
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
                                kind: typescript_1.ScriptElementKind.moduleElement,
                                name: handlerName,
                                containerName: `"${definitionFilePath}"`,
                                contextSpan: {
                                    start: definitionSourceFile.getStart(),
                                    length: definitionSourceFile.getWidth(),
                                },
                                containerKind: typescript_1.ScriptElementKind.moduleElement,
                            },
                        ],
                    };
                }
            }
            catch (error) {
                logger(error.message ? error.message : "unknown error");
                return original;
            }
        };
        return proxy;
    }
    return { create };
}
const findNodeInTree = (node, condition, logger) => {
    if (condition(node)) {
        return node;
    }
    else {
        let result;
        for (let i = 0; result == null && i < node.getChildCount(); i++) {
            result = findNodeInTree(node.getChildAt(i), condition, logger);
        }
        return result;
    }
};
module.exports = init;
//# sourceMappingURL=index.js.map