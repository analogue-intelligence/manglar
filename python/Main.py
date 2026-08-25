import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from bs4 import BeautifulSoup
import re
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class Sketch:
    name:str
    url:str
    dependencies: List[Tuple[str, Optional[str], Optional[str]]]


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


def main(pth: str):
    data_root = Path(pth).resolve()
    sketches: list[Sketch] = detect_dependencies(pth)
    merged = merge_dependency_sources(data_root, sketches, load_js_dependencies(data_root))
    export_dependencies_to_json(merged, data_root.parent / "out" / "taxonomy_obj.json")


def execute_sketch(sketch_folder: Path):
    try:
        from check_execution import run_sketch_in_browser
    except ModuleNotFoundError as error:
        print(f"\tSkipping browser execution for {sketch_folder}: {error}")
        return

    print(f"\t 🏭executing sketch: {sketch_folder}")
    try:
        run_sketch_in_browser(sketch_folder, headless=True)
    except Exception as error:
        print(f"\tSkipping browser execution for {sketch_folder}: {error}")


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


def load_js_dependencies(data_root: Path) -> List[Dict[str, Any]]:
    js_path = data_root.parent / "out" / "js_dependencies.json"

    if not js_path.exists():
        return []

    with js_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def merge_dependency_sources(
    data_root: Path,
    html_sketches: List[Sketch],
    js_sketches: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}

    for sketch in html_sketches:
        record = normalize_html_sketch(data_root, sketch)
        merged[record["_key"]] = record

    for sketch in js_sketches:
        record = normalize_js_sketch(data_root, sketch)
        key = record["_key"]
        if key in merged:
            merged[key]["dependencies"] = merge_dependencies(
                merged[key]["dependencies"],
                record["dependencies"],
            )
            if not merged[key]["meta"].get("path"):
                merged[key]["meta"]["path"] = record["meta"]["path"]
        else:
            merged[key] = record

    return [strip_internal_keys(record) for record in sorted(merged.values(), key=lambda item: item["_key"])]


def normalize_html_sketch(data_root: Path, sketch: Sketch) -> dict[str, Any]:
    sketch_path = Path(sketch.url).resolve()
    sketch_dir = sketch_path.parent.relative_to(data_root).as_posix()
    dependencies = []
    detected_file = sketch_path.relative_to(data_root).as_posix()

    for package, version, lib in sketch.dependencies:
        dependencies.append(normalize_dependency(
            name=package,
            value=str(package or lib),
            detected_in=["html"],
            detected_file=[detected_file],
        ))

    return {
        "_key": sketch_dir,
        "meta": {
            "sketchName": Path(sketch_dir).name,
            "version": "0.0.1",
            "path": sketch_dir,
        },
        "dependencies": dedupe_dependencies(dependencies),
    }


def normalize_js_sketch(data_root: Path, sketch: dict[str, Any]) -> dict[str, Any]:
    rel_path = Path(sketch["meta"]["path"])
    sketch_dir = rel_path.parent.as_posix()
    dependencies = [
        normalize_dependency(
            name=dep.get("name"),
            value=dep.get("value"),
            category=dep.get("category", "Third-Party Libraries"),
            dep_type=dep.get("type"),
            data_type=dep.get("dataType", "string"),
            detected_in=dep.get("detectedIn", ["js"]),
            detected_file=dep.get("detectedFile") or [rel_path.as_posix()],
        )
        for dep in sketch.get("dependencies", [])
    ]

    return {
        "_key": sketch_dir,
        "meta": {
            "sketchName": sketch.get("meta", {}).get("sketchName", Path(sketch_dir).name),
            "version": sketch.get("meta", {}).get("version", "0.0.1"),
            "path": sketch_dir,
        },
        "dependencies": dedupe_dependencies(dependencies),
    }


def normalize_dependency(
    name: Optional[str],
    value: Optional[str],
    category: str = "Third-Party Libraries",
    dep_type: Optional[str] = None,
    data_type: str = "string",
    detected_in: Optional[List[str]] = None,
    detected_file: Optional[List[str]] = None,
) -> Dict[str, Any]:
    dep_type = dep_type or infer_html_dependency_type(name)
    return {
        "category": category,
        "type": dep_type,
        "name": name,
        "value": value,
        "dataType": data_type,
        "detectedIn": normalize_provenance_list(detected_in),
        "detectedFile": normalize_provenance_list(detected_file),
    }


def infer_html_dependency_type(name: Optional[str]) -> str:
    if not name:
        return "Common JS libraries"

    normalized = name.lower()
    if normalized.startswith("p5"):
        return "P5 Libraries"
    return "Common JS libraries"


def dedupe_dependencies(dependencies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set = set()
    deduped: List[Dict[str, Any]] = []

    for dependency in dependencies:
        key = dependency_identity_key(dependency)
        if key in seen:
            for existing in deduped:
                if dependency_identity_key(existing) == key:
                    existing["detectedIn"] = merge_unique_values(
                        existing.get("detectedIn", []),
                        dependency.get("detectedIn", []),
                    )
                    existing["detectedFile"] = merge_unique_values(
                        existing.get("detectedFile", []),
                        dependency.get("detectedFile", []),
                    )
                    break
            continue
        seen.add(key)
        deduped.append(dependency)

    return deduped


def merge_dependencies(
    left: List[Dict[str, Any]],
    right: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    return dedupe_dependencies(left + right)


def strip_internal_keys(record: Dict[str, Any]) -> Dict[str, Any]:
    record = dict(record)
    record.pop("_key", None)
    return record


def export_dependencies_to_json(sketches: List[Dict[str, Any]], output_path: Path):
    os.makedirs(output_path.parent, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(sketches, f, indent=2)
    print(f"JSON file written successfully to {output_path}")


def normalize_provenance_list(values: Optional[Any]) -> List[str]:
    if not values:
        return []
    if isinstance(values, str):
        values = [values]
    normalized: List[str] = []
    for value in values:
        if value and value not in normalized:
            normalized.append(value)
    return normalized


def merge_unique_values(left: List[str], right: List[str]) -> List[str]:
    merged: List[str] = []
    for value in list(left) + list(right):
        if value and value not in merged:
            merged.append(value)
    return merged


def dependency_identity_key(dependency: Dict[str, Any]) -> tuple:
    return (
        dependency.get("category"),
        dependency.get("type"),
        dependency.get("name"),
        dependency.get("value"),
        dependency.get("dataType"),
    )



if __name__ == '__main__':
    main(sys.argv[1])
