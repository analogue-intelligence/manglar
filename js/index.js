import * as acorn from "acorn"
import * as recast from "recast";
import * as fs from 'node:fs/promises';
import * as path from 'path'
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const acornconfig = {
    ecmaVersion: "latest",
    sourceType: "module",
    allowReturnOutsideFunction: true
}

const KNOWN_GLOBALS = ['ml5', 'matter', 'dat', 'Tone', 'p5'];
const THIRD_PARTY_LIBRARY_TYPES = {
    p5: 'P5 Libraries',
    generic: 'Common JS libraries'
};

const BUILTIN_MODULES = new Set(
    builtinModules.flatMap((name) => [name, name.replace(/^node:/, '')])
);


class Sketch {
    constructor(name, url) {
        this.name = name;
        this.url = url;
        this.dependencies = new Map();
    }

    addDependency(dependency) {
        const key = dependencyKey(dependency);

        if (!this.dependencies.has(key)) {
            this.dependencies.set(key, dependency);
        }
    }

    toJSON() {
        const dependencies = [...this.dependencies.values()]
            .sort(compareDependencies)
            .map((dependency, index) => ({
                id: `dep-${String(index + 1).padStart(3, '0')}`,
                ...dependency
            }));

        return {
            meta: {
                sketchName: this.name,
                version: "0.0.1",
                path: this.url
            },
            dependencies
        };
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
    const artfolder = path.resolve(__dirname, "../data");
    await traverseFolder(artfolder);
    await exportMapToJSON(sketches, path.resolve(__dirname, "../out/js_dependencies.json"));
    console.log("Done!");
}

function addSketchDependency(filepath, dependency) {
    const sketchName = getSketchName(filepath);
    const sketchPath = getRelativeSketchPath(filepath);

    if (!sketches.has(sketchName)) {
        sketches.set(sketchName, new Sketch(sketchName, sketchPath));
    }

    sketches.get(sketchName).addDependency(dependency);
}

async function exportMapToJSON(map, filePath) {
    const payload = [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, sketch]) => sketch.toJSON());

    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
        console.log(`JSON file written successfully to ${filePath}`);
    } catch (error) {
        console.error('Error writing JSON file:', error);
    }
}

function processAST(filepath, ast) {
    recast.visit(ast, {
        visitImportDeclaration(path) {
            const source = path.value.source?.value;

            if (isThirdPartySource(source)) {
                const dependency = createThirdPartyDependency(source);
                console.log(`Found import dependency: ${source} from ${filepath}`);
                addSketchDependency(filepath, dependency);
            }

            this.traverse(path);
        },
        visitCallExpression(path) {
            const node = path.value;
            if (node.callee.name === 'require') {
                if (node.arguments.length > 0 && isStaticStringLiteral(node.arguments[0])) {
                    const dependencyName = node.arguments[0].value;
                    if (isThirdPartySource(dependencyName)) {
                        const dependency = createThirdPartyDependency(dependencyName);
                        console.log(`Found require() dependency: ${dependencyName} from ${filepath}`);
                        addSketchDependency(filepath, dependency);
                    }
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
                console.log(`Found implicit global dependency: ${name} from ${filepath}`);
                addSketchDependency(filepath, createThirdPartyDependency(name));

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

function getRelativeSketchPath(filepath) {
    return path.relative(path.resolve(__dirname, "../data"), filepath);
}

function isStaticStringLiteral(node) {
    return node && (node.type === 'Literal' || node.type === 'StringLiteral') && typeof node.value === 'string';
}

function isThirdPartySource(source) {
    if (!source || typeof source !== 'string') {
        return false;
    }

    if (source.startsWith('.') || source.startsWith('/')) {
        return false;
    }

    if (source.startsWith('node:') || BUILTIN_MODULES.has(source)) {
        return false;
    }

    return true;
}

function createThirdPartyDependency(name) {
    return {
        category: 'Third-Party Libraries',
        type: inferThirdPartyType(name),
        name,
        value: name,
        dataType: 'string'
    };
}

function inferThirdPartyType(name) {
    if (!name) {
        return THIRD_PARTY_LIBRARY_TYPES.generic;
    }

    if (KNOWN_GLOBALS.includes(name) || name.startsWith('p5')) {
        return THIRD_PARTY_LIBRARY_TYPES.p5;
    }

    return THIRD_PARTY_LIBRARY_TYPES.generic;
}

function dependencyKey(dependency) {
    return [
        dependency.category,
        dependency.type,
        dependency.name,
        dependency.value,
        dependency.dataType
    ].join('|');
}

function compareDependencies(a, b) {
    return (
        a.category.localeCompare(b.category) ||
        a.type.localeCompare(b.type) ||
        a.name.localeCompare(b.name) ||
        a.value.localeCompare(b.value)
    );
}
