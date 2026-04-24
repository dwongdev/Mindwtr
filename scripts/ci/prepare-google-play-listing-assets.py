#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

DEFAULT_LANGUAGE = "en-US"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
TYPE_ALIASES = {
    "phone": ("phoneScreenshots",),
    "phones": ("phoneScreenshots",),
    "phonescreenshots": "phoneScreenshots",
    "phone-screenshots": "phoneScreenshots",
    "phone_screenshots": "phoneScreenshots",
    "pad": ("sevenInchScreenshots", "tenInchScreenshots"),
    "pads": ("sevenInchScreenshots", "tenInchScreenshots"),
    "tablet": ("sevenInchScreenshots", "tenInchScreenshots"),
    "tablets": ("sevenInchScreenshots", "tenInchScreenshots"),
    "seveninchscreenshots": "sevenInchScreenshots",
    "seven-inch-screenshots": "sevenInchScreenshots",
    "seven_inch_screenshots": "sevenInchScreenshots",
    "teninchscreenshots": "tenInchScreenshots",
    "ten-inch-screenshots": "tenInchScreenshots",
    "ten_inch_screenshots": "tenInchScreenshots",
    "tvscreenshots": "tvScreenshots",
    "tv-screenshots": "tvScreenshots",
    "tv_screenshots": "tvScreenshots",
    "wearscreenshots": "wearScreenshots",
    "wear-screenshots": "wearScreenshots",
    "wear_screenshots": "wearScreenshots",
    "icon": "icon",
    "featuregraphic": "featureGraphic",
    "feature-graphic": "featureGraphic",
    "feature_graphic": "featureGraphic",
    "tvbanner": "tvBanner",
    "tv-banner": "tvBanner",
    "tv_banner": "tvBanner",
}


def normalize_image_types(name: str) -> tuple[str, ...]:
    image_types = TYPE_ALIASES.get(name.strip().lower())
    if image_types is None:
        return ()
    if isinstance(image_types, str):
        return (image_types,)
    return image_types


def image_files(path: Path) -> list[Path]:
    return sorted(
        file
        for file in path.iterdir()
        if file.is_file() and file.suffix.lower() in ALLOWED_EXTENSIONS
    )


def add_assets(assets: list[dict[str, str]], language: str, image_type: str, files: list[Path]) -> None:
    for file in files:
        assets.append(
            {
                "language": language,
                "imageType": image_type,
                "path": file.as_posix(),
            }
        )


def collect_assets(root: Path) -> list[dict[str, str]]:
    if not root.is_dir():
        return []

    assets: list[dict[str, str]] = []

    direct_root_files = image_files(root)
    if direct_root_files:
        add_assets(assets, DEFAULT_LANGUAGE, "phoneScreenshots", direct_root_files)

    for child in sorted(path for path in root.iterdir() if path.is_dir()):
        root_image_types = normalize_image_types(child.name)
        if root_image_types:
            files = image_files(child)
            for root_image_type in root_image_types:
                add_assets(assets, DEFAULT_LANGUAGE, root_image_type, files)
            continue

        locale = child.name
        locale_root_files = image_files(child)
        if locale_root_files:
            add_assets(assets, locale, "phoneScreenshots", locale_root_files)

        for grandchild in sorted(path for path in child.iterdir() if path.is_dir()):
            image_types = normalize_image_types(grandchild.name)
            if image_types:
                files = image_files(grandchild)
                for image_type in image_types:
                    add_assets(assets, locale, image_type, files)

    return assets


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "Usage: prepare-google-play-listing-assets.py <source-dir> <output-json>",
            file=sys.stderr,
        )
        return 1

    source_dir = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    assets = collect_assets(source_dir)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(assets, indent=2) + "\n", encoding="utf-8")

    if assets:
        grouped: dict[tuple[str, str], int] = {}
        for asset in assets:
            key = (asset["language"], asset["imageType"])
            grouped[key] = grouped.get(key, 0) + 1
        for (language, image_type), count in sorted(grouped.items()):
            print(f"{language} {image_type}: {count}")
    else:
        print("No Google Play listing assets found.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
