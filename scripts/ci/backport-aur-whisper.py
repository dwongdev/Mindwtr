#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


BLOCK_LINES = [
    "  # Backport whisper-rs 0.16 for Arch source builds.",
    "  # v0.7.3 fails with whisper-rs 0.15.1 / whisper-rs-sys 0.14.1 on current Arch.",
    "  if grep -q '^whisper-rs = \"0.15.1\"$' apps/desktop/src-tauri/Cargo.toml; then",
    "    sed -i 's/^whisper-rs = \"0.15.1\"$/whisper-rs = \"0.16.0\"/' apps/desktop/src-tauri/Cargo.toml",
    "    python - <<'EOF'",
    "from pathlib import Path",
    "path = Path(\"apps/desktop/src-tauri/src/lib.rs\")",
    "text = path.read_text(encoding=\"utf-8\")",
    "old = \"\"\"    if spec.channels == 2 {",
    "        audio = whisper_rs::convert_stereo_to_mono_audio(&audio).map_err(|e| e.to_string())?;",
    "    }",
    "\"\"\"",
    "new = \"\"\"    if spec.channels == 2 {",
    "        let mut mono_audio = vec![0.0f32; audio.len() / 2];",
    "        whisper_rs::convert_stereo_to_mono_audio(&audio, &mut mono_audio).map_err(|e| e.to_string())?;",
    "        audio = mono_audio;",
    "    }",
    "\"\"\"",
    "if old not in text:",
    "    raise SystemExit(\"mindwtr whisper backport target snippet not found\")",
    "path.write_text(text.replace(old, new), encoding=\"utf-8\")",
    "EOF",
    "    export RUSTUP_TOOLCHAIN=stable",
    "    cargo update --manifest-path apps/desktop/src-tauri/Cargo.toml -p whisper-rs --precise 0.16.0",
    "  fi",
]

START_MARKER = BLOCK_LINES[0]
END_MARKER = "  fi\n"
PREPARE_INSERT_AFTER = '  nvm install "${_nodeversion}"\n'


def patch_pkgbuild(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    block = "\n".join(BLOCK_LINES) + "\n"

    if START_MARKER in text:
        block_start = text.index(START_MARKER)
        block_end = text.index(END_MARKER, block_start) + len(END_MARKER)
        text = text[:block_start] + block + text[block_end:]
    else:
        if PREPARE_INSERT_AFTER not in text:
            raise SystemExit("Unable to find PKGBUILD prepare() insertion point")
        text = text.replace(PREPARE_INSERT_AFTER, PREPARE_INSERT_AFTER + "\n" + block, 1)

    path.write_text(text, encoding="utf-8")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: backport-aur-whisper.py <PKGBUILD>", file=sys.stderr)
        return 1

    patch_pkgbuild(Path(argv[1]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
