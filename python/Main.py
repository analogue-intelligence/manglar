import os
import sys
from dataclasses import dataclass
from pathlib import Path
from bs4 import BeautifulSoup
import re

@dataclass
class Sketch:
    name:str
    url:str
    dependencies: dict[str, str]


sketches:list[Sketch] = []


def get_version(dependency_name: str) -> tuple[str, str]:
    pattern = r"/([^/]+)@([\d.]+)"
    match = re.search(pattern, dependency_name)

    if match:
        return match.group(1), match.group(2)
    return ()




def detect_dependencies(f: Path):
    soup = BeautifulSoup(open(f), "html.parser")

    for link in soup.find_all("script"):
        dependency_name: str = link.get('src')
        print(f"\t ⌁ {dependency_name}")
        print(get_version(dependency_name))


def main(pth: str):
    p: Path = Path(pth)
    for root, dirs, files in os.walk(p):
        for file in files:
            if file.endswith(".html"):
                # let's get the parent folder name
                sketch_folder:Path = Path(root)
                print(f"Sketch: {sketch_folder}")
                print(f"Detecting dependencies...")
                detect_dependencies(sketch_folder.joinpath(file))


if __name__ == '__main__':
    main(sys.argv[1])

