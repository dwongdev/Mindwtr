#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_LANGUAGE = "en-US"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
GOOGLE_PLAY_IMAGE_CONSTRAINTS = {
    "tenInchScreenshots": {
        "min_side": 1080,
        "max_side": 7680,
        "max_aspect_ratio": 2.3,
    },
}
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


def imagemagick_resize_command() -> list[str] | None:
    magick = shutil.which("magick")
    if magick:
        return [magick]
    convert = shutil.which("convert")
    if convert:
        return [convert]
    return None


def imagemagick_identify_command() -> list[str] | None:
    magick = shutil.which("magick")
    if magick:
        return [magick, "identify"]
    identify = shutil.which("identify")
    if identify:
        return [identify]
    return None


def image_dimensions(file: Path) -> tuple[int, int] | None:
    command = imagemagick_identify_command()
    if command is None:
        raise RuntimeError("ImageMagick is required to inspect Google Play listing screenshots")

    result = subprocess.run(
        [*command, "-format", "%w %h", file.as_posix()],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    parts = result.stdout.strip().split()
    if len(parts) != 2:
        return None
    return int(parts[0]), int(parts[1])


def satisfies_google_play_constraints(dimensions: tuple[int, int], constraints: dict[str, float]) -> bool:
    width, height = dimensions
    min_side = min(width, height)
    max_side = max(width, height)
    aspect_ratio = max_side / min_side
    return (
        min_side >= constraints["min_side"]
        and max_side <= constraints["max_side"]
        and aspect_ratio <= constraints["max_aspect_ratio"]
    )


def resize_geometry_preserving_aspect(dimensions: tuple[int, int], min_side: int) -> str:
    width, height = dimensions
    if width < height:
        return f"{min_side}x"
    if height < width:
        return f"x{min_side}"
    return f"{min_side}x{min_side}"


def resize_image_preserving_aspect(source: Path, target: Path, dimensions: tuple[int, int], min_side: int) -> None:
    command = imagemagick_resize_command()
    if command is None:
        raise RuntimeError("ImageMagick is required to resize Google Play listing screenshots")

    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            *command,
            source.as_posix(),
            "-resize",
            resize_geometry_preserving_aspect(dimensions, min_side),
            target.as_posix(),
        ],
        check=True,
    )


def prepared_google_play_asset(
    file: Path,
    language: str,
    image_type: str,
    generated_dir: Path,
) -> Path | None:
    constraints = GOOGLE_PLAY_IMAGE_CONSTRAINTS.get(image_type)
    if constraints is None:
        return file

    dimensions = image_dimensions(file)
    if dimensions is None:
        print(f"Skipping {file}: unable to read dimensions for {image_type}", file=sys.stderr)
        return None

    if satisfies_google_play_constraints(dimensions, constraints):
        return file

    width, height = dimensions
    aspect_ratio = max(width, height) / min(width, height)
    if aspect_ratio > constraints["max_aspect_ratio"]:
        print(
            f"Skipping {file} for {image_type}: {width}x{height} outside Google Play limits",
            file=sys.stderr,
        )
        return None

    source_min_side = min(width, height)
    source_max_side = max(width, height)
    target_min_side = int(constraints["min_side"])
    scaled_max_side = (source_max_side * target_min_side + source_min_side - 1) // source_min_side
    if scaled_max_side > constraints["max_side"]:
        print(
            f"Skipping {file} for {image_type}: resizing the short side to "
            f"{target_min_side}px would make the long side {scaled_max_side}px",
            file=sys.stderr,
        )
        return None

    target = generated_dir / language / image_type / file.name
    resize_image_preserving_aspect(file, target, dimensions, target_min_side)
    actual_dimensions = image_dimensions(target)
    if actual_dimensions is None or not satisfies_google_play_constraints(actual_dimensions, constraints):
        raise RuntimeError(
            f"Resized {file} for {image_type} to invalid dimensions: {actual_dimensions}"
        )
    print(
        f"Resized Google Play listing asset {file} -> {target} "
        f"({actual_dimensions[0]}x{actual_dimensions[1]}, aspect preserved)",
        file=sys.stderr,
    )
    return target


def add_assets(
    assets: list[dict[str, str]],
    language: str,
    image_type: str,
    files: list[Path],
    generated_dir: Path,
) -> None:
    for file in files:
        asset_path = prepared_google_play_asset(file, language, image_type, generated_dir)
        if asset_path is None:
            continue
        assets.append(
            {
                "language": language,
                "imageType": image_type,
                "path": asset_path.as_posix(),
            }
        )


def collect_assets(root: Path, generated_dir: Path) -> list[dict[str, str]]:
    if not root.is_dir():
        return []

    assets: list[dict[str, str]] = []

    direct_root_files = image_files(root)
    if direct_root_files:
        add_assets(assets, DEFAULT_LANGUAGE, "phoneScreenshots", direct_root_files, generated_dir)

    for child in sorted(path for path in root.iterdir() if path.is_dir()):
        root_image_types = normalize_image_types(child.name)
        if root_image_types:
            files = image_files(child)
            for root_image_type in root_image_types:
                add_assets(assets, DEFAULT_LANGUAGE, root_image_type, files, generated_dir)
            continue

        locale = child.name
        locale_root_files = image_files(child)
        if locale_root_files:
            add_assets(assets, locale, "phoneScreenshots", locale_root_files, generated_dir)

        for grandchild in sorted(path for path in child.iterdir() if path.is_dir()):
            image_types = normalize_image_types(grandchild.name)
            if image_types:
                files = image_files(grandchild)
                for image_type in image_types:
                    add_assets(assets, locale, image_type, files, generated_dir)

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
    generated_dir = output_path.parent / "play-listing-assets-resized"
    shutil.rmtree(generated_dir, ignore_errors=True)
    assets = collect_assets(source_dir, generated_dir)

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
