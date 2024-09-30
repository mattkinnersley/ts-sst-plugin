"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const typescript_1 = require("typescript/lib/typescript");
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
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
                const result = sourceFile
                    ? findTargetNode(sourceFile, position, logger)
                    : null;
                if (!result?.node) {
                    logger(`No target node found`);
                    return original;
                }
                else {
                    let definitionFilePath = null;
                    let definitionName = null;
                    let definitionSourceFile;
                    if (result.key === "dynamoSubscription" ||
                        result.key === "functionHandler") {
                        const [start, end] = result.node.getText().split(".");
                        const definitionFilename = `${start.replaceAll(`"`, "")}.ts`;
                        definitionName = end.replaceAll(`"`, "");
                        definitionFilePath = `${projectDir}/${definitionFilename}`;
                        definitionSourceFile =
                            getProgram().getSourceFile(definitionFilePath);
                    }
                    if (result.key === "packagePath") {
                        const definitionFilename = result.node
                            .getText()
                            .replaceAll(`"`, "");
                        definitionFilePath = `${projectDir}/${definitionFilename}/package.json`;
                        definitionName = "package.json";
                        definitionSourceFile = (0, typescript_1.createSourceFile)(definitionFilePath, (0, fs_1.readFileSync)(definitionFilePath).toString(), typescript_1.ScriptTarget.JSON);
                    }
                    if (!definitionSourceFile) {
                        logger(`No source file found for ${definitionFilePath}`);
                        return original;
                    }
                    logger(`Found source file for ${definitionFilePath}`);
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
                                kind: typescript_1.ScriptElementKind.moduleElement,
                                name: definitionName || definitionSourceFile.fileName,
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
const findNodeInTree = (node, conditions, logger) => {
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
            logger(`child ${i} of kind ${typescript_1.SyntaxKind[children[i].kind]}: ${children[i].getFullText()}`);
        }
        logger(`grandparents kind: ${typescript_1.SyntaxKind[node.parent?.parent.kind]}`);
        logger(`parents kind: ${typescript_1.SyntaxKind[node.parent?.kind]}`);
        const parentsChildren = node.parent.getChildren();
        for (let i = 0; i < parentsChildren.length; i++) {
            logger(`parent child ${i} of kind ${typescript_1.SyntaxKind[parentsChildren[i].kind]}: ${parentsChildren[i].getFullText()}`);
        }
        logger("parent child 0: " + node.parent.getChildAt(0).getFullText());
        logger("this kind: " + typescript_1.SyntaxKind[node.kind]);
        logger("this text: " + node.getText());
        return { node, key };
    }
    else {
        let result;
        for (let i = 0; result == null && i < node.getChildCount(); i++) {
            result = findNodeInTree(node.getChildAt(i), conditions, logger);
        }
        return result;
    }
};
const findTargetNode = (sourceFile, position, logger) => {
    const result = sourceFile
        ? findNodeInTree(sourceFile, [
            {
                fn: (node) => node.kind === typescript_1.SyntaxKind.StringLiteral &&
                    node.parent.kind === typescript_1.SyntaxKind.PropertyAssignment &&
                    node.parent.getFirstToken()?.getText() === "handler" &&
                    node.getStart() <= position &&
                    node.getEnd() >= position,
                key: "functionHandler",
            },
            {
                fn: (node) => node.kind === typescript_1.SyntaxKind.StringLiteral &&
                    node.parent.kind === typescript_1.SyntaxKind.PropertyAssignment &&
                    node.parent.getFirstToken()?.getText() === "path" &&
                    node.getStart() <= position &&
                    node.getEnd() >= position,
                key: "packagePath",
            },
            {
                fn: (node) => node.kind === typescript_1.SyntaxKind.StringLiteral &&
                    node.parent.getChildAt(0).kind ===
                        typescript_1.SyntaxKind.PropertyAccessExpression &&
                    node.parent.getChildAt(0).getFullText().includes(".subscribe") &&
                    node.getStart() <= position &&
                    node.getEnd() >= position,
                key: "dynamoSubscription",
            },
        ], logger)
        : null;
    return result;
};
module.exports = init;
//# sourceMappingURL=index.js.map