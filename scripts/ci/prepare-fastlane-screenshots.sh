#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <ios|macos> <source_root>" >&2
  exit 1
fi

PLATFORM="$1"
SOURCE_ROOT="$2"

if [ -z "${FASTLANE_SCREENSHOTS_DIR:-}" ]; then
  echo "FASTLANE_SCREENSHOTS_DIR is required" >&2
  exit 1
fi

if [ -z "${FASTLANE_METADATA_PATH:-}" ]; then
  echo "FASTLANE_METADATA_PATH is required" >&2
  exit 1
fi

rm -rf "${FASTLANE_SCREENSHOTS_DIR}"
mkdir -p "${FASTLANE_SCREENSHOTS_DIR}"

mapfile -t LOCALES < <(
  find "${FASTLANE_METADATA_PATH}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
    | sort \
    | grep -Ev '^(review_information|trade_representative_contact_information)$' || true
)

if [ "${#LOCALES[@]}" -eq 0 ]; then
  echo "No fastlane locales found under ${FASTLANE_METADATA_PATH}; skipping screenshot preparation." >&2
  exit 0
fi

had_files=0
warned_paths=$'\n'

is_supported_ios_iphone_size() {
  case "$1" in
    1260x2736|2736x1260|1290x2796|2796x1290|1320x2868|2868x1320|1284x2778|2778x1284|1242x2688|2688x1242|1179x2556|2556x1179|1206x2622|2622x1206|1170x2532|2532x1170|1125x2436|2436x1125|1080x2340|2340x1080|1242x2208|2208x1242|750x1334|1334x750|640x1096|1096x640|640x1136|1136x640|640x920|920x640|640x960|960x640)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_supported_ios_ipad_size() {
  case "$1" in
    2064x2752|2752x2064|2048x2732|2732x2048|1488x2266|2266x1488|1668x2420|2420x1668|1668x2388|2388x1668|1640x2360|2360x1640|1668x2224|2224x1668|1536x2008|2008x1536|1536x2048|2048x1536|768x1004|1004x768|768x1024|1024x768)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_supported_macos_size() {
  case "$1" in
    1280x800|1440x900|2560x1600|2880x1800)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

warn_if_unrecognized_dimensions() {
  local path="$1"
  local label="$2"
  local info=""
  local size=""

  info="$(file -b "${path}" 2>/dev/null || true)"
  if [[ "${info}" =~ ([0-9]+)\ x\ ([0-9]+) ]]; then
    size="${BASH_REMATCH[1]}x${BASH_REMATCH[2]}"
  fi

  if [ -z "${size}" ]; then
    echo "::warning::Unable to determine screenshot dimensions for ${path}; App Store Connect may reject the asset."
    return
  fi

  case "${PLATFORM}:${label}" in
    ios:iPhone)
      if ! is_supported_ios_iphone_size "${size}"; then
        case "${warned_paths}" in
          *$'\n'"${path}"$'\n'*) return ;;
        esac
        warned_paths="${warned_paths}${path}"$'\n'
        echo "::warning::${path} uses ${size}, which is not one of Apple's accepted iPhone App Store screenshot sizes."
      fi
      ;;
    ios:iPad)
      if ! is_supported_ios_ipad_size "${size}"; then
        case "${warned_paths}" in
          *$'\n'"${path}"$'\n'*) return ;;
        esac
        warned_paths="${warned_paths}${path}"$'\n'
        echo "::warning::${path} uses ${size}, which is not one of Apple's accepted iPad App Store screenshot sizes."
      fi
      ;;
    macos:macOS)
      if ! is_supported_macos_size "${size}"; then
        case "${warned_paths}" in
          *$'\n'"${path}"$'\n'*) return ;;
        esac
        warned_paths="${warned_paths}${path}"$'\n'
        echo "::warning::${path} uses ${size}, which is not one of Apple's accepted Mac App Store screenshot sizes."
      fi
      ;;
  esac
}

copy_group() {
  local src_dir="$1"
  local prefix="$2"
  local dest_dir="$3"
  local label="$4"

  if [ ! -d "${src_dir}" ]; then
    echo "Skipping ${label} screenshots (missing directory: ${src_dir})" >&2
    return
  fi

  mapfile -t files < <(
    find "${src_dir}" -mindepth 1 -maxdepth 1 -type f \
      \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) \
      | sort
  )

  if [ "${#files[@]}" -eq 0 ]; then
    echo "Skipping ${label} screenshots (no image files found in ${src_dir})" >&2
    return
  fi

  local index=1
  local file=""
  for file in "${files[@]}"; do
    local base_name
    local stem
    local ext
    local ordinal
    base_name="$(basename "${file}")"
    stem="${base_name%.*}"
    ext="${base_name##*.}"
    warn_if_unrecognized_dimensions "${file}" "${label}"
    printf -v ordinal '%02d' "${index}"
    cp "${file}" "${dest_dir}/${prefix}-${ordinal}-${stem}.${ext}"
    index=$((index + 1))
    had_files=1
  done
}

prepare_ios_locale() {
  local locale="$1"
  local dest_dir="${FASTLANE_SCREENSHOTS_DIR}/${locale}"
  mkdir -p "${dest_dir}"
  copy_group "${SOURCE_ROOT}/iphone" "iphone" "${dest_dir}" "iPhone"
  copy_group "${SOURCE_ROOT}/ipad" "ipad" "${dest_dir}" "iPad"
}

prepare_macos_locale() {
  local locale="$1"
  local dest_dir="${FASTLANE_SCREENSHOTS_DIR}/${locale}"
  mkdir -p "${dest_dir}"
  copy_group "${SOURCE_ROOT}" "mac" "${dest_dir}" "macOS"
}

locale=""
for locale in "${LOCALES[@]}"; do
  case "${PLATFORM}" in
    ios)
      prepare_ios_locale "${locale}"
      ;;
    macos)
      prepare_macos_locale "${locale}"
      ;;
    *)
      echo "Unsupported platform: ${PLATFORM}" >&2
      exit 1
      ;;
  esac
done

if [ "${had_files}" -eq 0 ]; then
  echo "No screenshots were prepared for ${PLATFORM}." >&2
  exit 0
fi

echo "Prepared fastlane screenshots for ${PLATFORM}:"
find "${FASTLANE_SCREENSHOTS_DIR}" -type f | sort
