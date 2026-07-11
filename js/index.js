import * as acorn from "acorn"
import * as recast from "recast";
import * as fs from 'node:fs';
// import { Visitor } from 'recast';
import * as path from 'path'

let acornconfig = {
    ecmaVersion: 9,
    sourceType: "script",
    allowReturnOutsideFunction: true
}
const rawAstFolder = "astAnalysis/rawASTs/";
const KNOWN_GLOBALS = ['ml5', 'matter', 'dat', 'Tone', 'p5'];

function traverseFolder(artfolder) {
    fs.readdir(artfolder, (err, files) => {
        files.forEach(file => {
            const filePath = path.join(artfolder, file);

            if (fs.statSync(filePath).isDirectory()) {
                traverseFolder(filePath);
            } else if (fs.statSync(filePath).isFile() && filePath.endsWith(".js")) {
                try {
                    const code = fs.readFileSync(filePath).toString();
                    const ast = acorn.parse(code, acornconfig).body;
                    console.log(filePath);
                    // serializeAST(file, ast)
                    // AST transformation
                    processAST(ast);
                } catch (error) {
                    console.error(`Error reading or parsing file ${file}:`, error.message);
                }

            } else {

            }
        });
    });
}

function main() {
    const artfolder = "../data/"
    traverseFolder(artfolder);
}

function processAST(ast) {
    recast.visit(ast, {
        visitImportDeclaration(path) {
            console.log("Found ES6 import:" + path.value.id.name);
            this.traverse(path);
        },
        visitCallExpression(path) {
            const node = path.value;
            if (node.callee.name === 'require') {
                if (node.arguments.length > 0 && (node.arguments[0].type === 'Literal' || node.arguments[0].type === 'StringLiteral')) {
                    console.log("Found require() Dependency:", node.arguments[0].value);
                }
            }
            this.traverse(path);
        },
        // Catches Implicit Globals (e.g., ml5.imageClassifier or new p5.SoundFile)
        visitIdentifier(path) {
            const name = path.value.name;

            if (KNOWN_GLOBALS.includes(name)) {
                // Basic heuristic check: Ensure it's not a variable declaration *inside* this file
                // (e.g., matching `const ml5 = ...` would be redundant or a local override)
                const parent = path.parent?.value;
                if (parent && parent.type === 'VariableDeclarator' && parent.id.name === name) {
                    // Skip if it's the one declaring it
                    return this.traverse(path);
                }
                console.log(`Found Implicit Global Dependency usage: ${name}`);
                // console.log(path.parent);

            }
            this.traverse(path);
        }
    });
}

main();