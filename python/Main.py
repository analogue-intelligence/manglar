import os
import sys
from dataclasses import dataclass
from pathlib import Path
from bs4 import BeautifulSoup
import re

import pandas as pd

@dataclass
class Sketch:
    name:str
    url:str
    dependencies: dict[str, str]


def get_version(dependency_name: str) -> tuple[str, str]:
    # pattern = r"/([^/]+)@([\d.]+)"
    pattern = r"/([^/]+)@([\d.]+)/.*\/([^/]+)$"
    match = re.search(pattern, dependency_name)

    if match:
        return match.group(1), match.group(2), match.group(3)
    return ()


def extract_dependencies(f: Path):
    soup = BeautifulSoup(open(f), "html.parser")
    dependencies = []

    for link in soup.find_all("script"):
        dependency_name: str = link.get('src')
        print(f"\t ⌁ {dependency_name}")
        print(get_version(dependency_name))
        dependencies.append(get_version(dependency_name))
    return dependencies


def export_dependencies_to_df(sketches):
    rows = []
    for sketch in sketches:
        # remove empty dependencies (e.g., current sketch.js it's detected as a dependency
        valid_deps = [dep for dep in sketch.dependencies if dep]
        rows_tmp = []
        for package, version, lib in valid_deps:
            rows_tmp.append({
                "name": sketch.name,
                "url": str(sketch.url),  # Convert PosixPath to string for cleaner display
                "dependency_name": package,
                "dependency_version": version,
                "file_name": lib
            })

        if not rows_tmp:
            rows_tmp.append({
                "name": sketch.name,
                "url": str(sketch.url),
                "dependency_name": None,
                "dependency_version": None,
                "file_name": None
            })

        rows += rows_tmp
    df = pd.DataFrame(rows)
    print(df)

def main(pth: str):
    sketches:list[Sketch] = detect_dependencies(pth)
    # sketches.append(s)

    export_dependencies_to_df(sketches)


def detect_dependencies(pth: str):
    sketches: list[Sketch] = []
    p: Path = Path(pth)
    for root, dirs, files in os.walk(p):
        for file in files:
            if file.endswith(".html"):
                # let's get the parent folder name
                sketch_folder: Path = Path(root)
                print(f"Sketch: {sketch_folder}")
                print(f"Detecting dependencies...")

                fp_sketch = sketch_folder.joinpath(file)
                dependencies = extract_dependencies(fp_sketch)
                sketches.append(Sketch(file, fp_sketch, dependencies))

    return sketches



if __name__ == '__main__':
    main(sys.argv[1])

