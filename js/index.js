import * as acorn from "acorn"
import * as recast from "recast";
import * as fs from 'node:fs/promises';
// import { Visitor } from 'recast';
import * as path from 'path'

let acornconfig = {
    ecmaVersion: 9,
    sourceType: "script",
    allowReturnOutsideFunction: true
}

const KNOWN_GLOBALS = ['ml5', 'matter', 'dat', 'Tone', 'p5'];


class Sketch {
    constructor(name, url) {
        this.name = name;
        this.url = url;
        this.dependencies = new Set();
    }
}



async function traverseFolder(artfolder) {
    const files = await fs.readdir(artfolder);

    await Promise.all(files.map(async file => {
        const filePath = path.join(artfolder, file);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
            await traverseFolder(filePath);
        } else if (stat.isFile() && filePath.endsWith(".js")) {
            try {
                const code = await fs.readFile(filePath, "utf8");
                const ast = acorn.parse(code, acornconfig).body;
                console.log(filePath);
                processAST(filePath, ast);
            } catch (error) {
                console.error(`Error reading or parsing file ${file}:`, error.message);
            }
        }
    }));
}

const sketches = new Map();

async function main() {
    const artfolder = "../data/"
    await traverseFolder(artfolder);
    await exportMapToCSV(sketches);
    // console.log(sketches);
    console.log("Done!");
}

function addSketchDependency(filepath, dependencyName) {
    const sketchName = getSketchName(filepath);

    if (!sketches.has(sketchName)) {
        sketches.set(sketchName, new Sketch(sketchName, filepath));
    }
    sketches.get(sketchName).dependencies.add(dependencyName);
    // console.log(sketches.get(sketchName));
}

async function exportMapToCSV(map, filePath = '../out/js_dependencies.csv') {
  let csvContent = 'parent_folder,url,dependency_name\n';//,file_name

  for (const [key, value] of map.entries()) {
    // Sanitize quotes and wrap in quotes to preserve formatting and commas
    const safeKey = `"${String(key).replace(/"/g, '""')}"`;
    const url = `"${String(value.url).replace(/"/g, '""')}"`;
    // const deps = `"${String(value.dependencies).replace(/"/g, '""')}"`;

    const jsonArray = JSON.stringify([...value.dependencies]);

    csvContent += `${key},${value.url},"[${[...value.dependencies]}]"\n`;
  }

  try {
    await fs.writeFile(filePath, csvContent, 'utf-8');
    console.log(`CSV file written successfully to ${filePath}`);
  } catch (error) {
    console.error('Error writing CSV file:', error);
  }
}

function processAST(filepath, ast) {
    recast.visit(ast, {
        visitImportDeclaration(path) {
            const dependencyName = path.value.id.name;
            console.log("Found ES6 import:" + dependencyName + " from " + filepath);
            addSketchDependency(filepath, dependencyName);
            this.traverse(path);
        },
        visitCallExpression(path) {
            const node = path.value;
            if (node.callee.name === 'require') {
                if (node.arguments.length > 0 && (node.arguments[0].type === 'Literal' || node.arguments[0].type === 'StringLiteral')) {
                    const dependencyName = node.arguments[0].value
                    console.log("Found require() Dependency:", dependencyName  + " from " + filepath);
                    addSketchDependency(filepath, dependencyName);
                }
            }
            this.traverse(path);
        },
        // Catches Implicit Globals (e.g., ml5.imageClassifier or new p5.SoundFile)
        visitIdentifier(path) {
            const name = path.value.name;

            if (KNOWN_GLOBALS.includes(name) || KNOWN_GLOBALS.includes(name.toString().toLowerCase())) {
                // Basic heuristic check: Ensure it's not a variable declaration *inside* this file
                // (e.g., matching `const ml5 = ...` would be redundant or a local override)
                const parent = path.parent?.value;
                if (parent && parent.type === 'VariableDeclarator' && parent.id.name === name) {
                    // Skip if it's the one declaring it
                    return this.traverse(path);
                }
                console.log(`Found Implicit Global Dependency usage: ${name}` + " from " + filepath);
                addSketchDependency(filepath, name);

            }
            this.traverse(path);
        }
    });
}

main();

// console.log(getSketchName("../data/sketch_example/sketch.js"));

function getSketchName(filepath) {
    return filepath.split('/').at(-2);
}