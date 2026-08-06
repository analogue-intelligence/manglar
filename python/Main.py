import os
import sys
from dataclasses import dataclass
from pathlib import Path
from bs4 import BeautifulSoup
import re

import pandas as pd
from pandas import DataFrame

from check_execution import run_sketch_in_browser


@dataclass
class Sketch:
    name:str
    url:str
    dependencies: dict[str, str]


def get_version(dependency_name: str) -> tuple:
    """
    Parses a dependency string to extract the dependency name, version, and filename.
    :param dependency_name: The string containing the dependency information in the
        format `/dependency_name@version/other_info/filename`.
    :return: A tuple containing the extracted dependency name, version, and filename;
        if not found, the original dependency name with version and filename as None.
    """
    # pattern = r"/([^/]+)@([\d.]+)"
    pattern = r"/([^/]+)@([\d.]+)/.*\/([^/]+)$"
    match = re.search(pattern, dependency_name)

    if match:
        # name, version, filename
        return match.group(1), match.group(2), match.group(3)
    return (dependency_name, None, None)


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
    df = create_df(sketches)

    if not df.empty:
        os.makedirs(Path("../out"), exist_ok=True)
        df.to_csv("../out/html_dependencies.csv", index=False)


def create_df(sketches) -> DataFrame:
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
    return pd.DataFrame(rows)

def main(pth: str):
    sketches:list[Sketch] = detect_dependencies(pth)
    # sketches.append(s)

    export_dependencies_to_df(sketches)


def execute_sketch(sketch_folder: Path):
    print(f"\t 🏭executing sketch: {sketch_folder}")
    run_sketch_in_browser(sketch_folder, headless=False)


def detect_dependencies(pth: str):
    sketches: list[Sketch] = []
    p: Path = Path(pth)
    for root, dirs, files in os.walk(p):
        for file in files:
            if file.endswith(".html"):
                # let's get the parent folder name
                sketch_folder: Path = Path(root)
                print(f"Sketch: {sketch_folder}")
                print(f"\tDetecting dependencies...")

                fp_sketch = sketch_folder.joinpath(file)
                dependencies = extract_dependencies(fp_sketch)
                sketches.append(Sketch(file, fp_sketch, dependencies))

                execute_sketch(sketch_folder)
                print("---------------------------")

    return sketches



if __name__ == '__main__':
    main(sys.argv[1])

