#!/bin/sh

set -eu

tag="${CI_COMMIT_TAG:-local}"
commit="${CI_COMMIT_SHA:-$(git rev-parse HEAD)}"
safe_tag=$(printf '%s' "$tag" | tr -c 'A-Za-z0-9._-' '-')
package_name="edugrid-mppt-${safe_tag}"
package_dir="release/${package_name}"

rm -rf -- "$package_dir"
mkdir -p "$package_dir/arduino-nano" "$package_dir/arduino-nano-esp32"

cp firmware/.pio/build/nanoatmega328new/firmware.hex \
   "$package_dir/arduino-nano/edugrid-mppt-${safe_tag}.hex"

cp firmware/.pio/build/arduino_nano_esp32/firmware.bin \
   "$package_dir/arduino-nano-esp32/firmware.bin"
cp firmware/.pio/build/arduino_nano_esp32/littlefs.bin \
   "$package_dir/arduino-nano-esp32/littlefs.bin"
cp firmware/.pio/build/arduino_nano_esp32/bootloader.bin \
   "$package_dir/arduino-nano-esp32/bootloader.bin"
cp firmware/.pio/build/arduino_nano_esp32/partitions.bin \
   "$package_dir/arduino-nano-esp32/partitions.bin"
cp frontend/dist/edugrid-mppt.html \
   "$package_dir/edugrid-mppt-standalone.html"
cp firmware/README.md "$package_dir/FIRMWARE-README.md"
cp LICENSE.md "$package_dir/LICENSE.md"

cat > "$package_dir/BUILD-INFO.txt" <<EOF
EduGrid MPPT release package
Tag: $tag
Commit: $commit
Pipeline: ${CI_PIPELINE_URL:-local build}

arduino-nano/
  The classic Arduino Nano firmware in Intel HEX format.

arduino-nano-esp32/
  firmware.bin    Application image for OTA or serial flashing.
  littlefs.bin    Dashboard filesystem image.
  bootloader.bin  ESP32-S3 bootloader image for complete serial recovery.
  partitions.bin  Partition table for complete serial recovery.

edugrid-mppt-standalone.html
  Self-contained simulation dashboard; no web server or internet required.
EOF

(
  cd "$package_dir"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 sha256sum > SHA256SUMS
)

python -m zipfile -c "release/${package_name}.zip" "$package_dir"
