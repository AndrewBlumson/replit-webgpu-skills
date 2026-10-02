#!/usr/bin/env python3
"""Create the durable planning, asset-pipeline, and QA documents used by this skill."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


TEMPLATES = {
    "GAME-BRIEF.template.md": "GAME-BRIEF.md",
    "ASSET-PIPELINE.template.md": "ASSET-PIPELINE.md",
    "ACCEPTANCE.template.md": "ACCEPTANCE.md",
    "QA-ROUTE.template.md": "QA-ROUTE.md",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Scaffold the game brief, asset pipeline, acceptance ledger, and "
            "rendered QA route."
        )
    )
    parser.add_argument("project", type=Path, help="Project directory")
    parser.add_argument(
        "--docs-dir",
        default="docs",
        help="Documentation directory relative to the project (default: docs)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace existing target documents instead of preserving them",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project = args.project.expanduser().resolve()
    assets = Path(__file__).resolve().parent.parent / "assets"
    docs = project / args.docs_dir

    if not project.exists() or not project.is_dir():
        raise SystemExit(f"Project directory does not exist: {project}")

    docs.mkdir(parents=True, exist_ok=True)
    created: list[Path] = []
    preserved: list[Path] = []

    for template_name, target_name in TEMPLATES.items():
        source = assets / template_name
        target = docs / target_name
        if target.exists() and not args.force:
            preserved.append(target)
            continue
        shutil.copyfile(source, target)
        created.append(target)

    for path in created:
        print(f"created {path}")
    for path in preserved:
        print(f"preserved {path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
