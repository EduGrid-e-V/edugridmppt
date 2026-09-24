# CI/CD and release builds

GitLab CI is defined in `.gitlab-ci.yml` and has two entry points:

- Every push to the default branch rebuilds and deploys the standalone simulation
  dashboard to GitLab Pages.
- Every tag builds a downloadable firmware package. The packaging job verifies
  that the tagged commit belongs to the default branch and fails otherwise.

## Creating a firmware package

Tag a commit that is already on `main`, then push the tag:

```bash
git switch main
git pull --ff-only
git tag -a v1.0.0 -m "EduGrid MPPT v1.0.0"
git push origin v1.0.0
```

The tag pipeline compiles:

- Classic Arduino Nano firmware as an Intel HEX file.
- Arduino Nano ESP32 application firmware.
- Arduino Nano ESP32 LittleFS dashboard image.
- ESP32 bootloader and partition-table recovery images.
- The self-contained standalone dashboard.

Download `edugrid-mppt-<tag>.zip` from the `package-firmware` job artifacts.
The archive contains `SHA256SUMS` and build metadata. Release artifacts do not
expire automatically.

## GitLab Pages

The `deploy-pages` job publishes the current `main` dashboard as both `index.html`
and `edugrid-mppt.html`. The generated page is a single HTML file with its scripts
and styles embedded, so it has no CDN or runtime internet dependency.

GitLab Pages must be enabled in the GitLab project settings. The deployed URL is
shown under **Deploy > Pages** after the first successful `main` pipeline.

## Reproducibility

- JavaScript packages are installed with `npm ci` from `package-lock.json`.
- PlatformIO Core is pinned in CI.
- The AVR and ESP32 PlatformIO platforms are pinned in `firmware/platformio.ini`.
- CI caches downloads but never uses cached build outputs as release artifacts.
