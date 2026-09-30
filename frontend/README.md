# EduGrid MPPT Dashboard

This is the browser dashboard for the EduGrid MPPT trainer. The same Vue source has two compile-time targets:

- The firmware target is served by the ESP32 from LittleFS and talks to the firmware through WebSockets and HTTP endpoints.
- The standalone target starts in simulation mode and includes the Berry Algorithm Lab in one offline HTML file.

The built dashboard is intentionally self-contained. It should not rely on external CDNs because the ESP32 usually serves it from its own access point. The header language selector switches the dashboard, charts, Berry guidance, and logging UI between English, German, and Spanish immediately. The initial language follows the browser locale; student-edited Berry code is never translated or overwritten. The same built-in translations ship in both firmware and standalone builds, with no runtime network request.

## Project Layout

```text
frontend/
  index.html
  package.json
  vite.config.js
  src/
    App.vue
    components/
    services/
```

Key services:

- `src/simulation/SimpleSimulation.js` is the single model used by both frontend simulation paths. It represents the classroom panel as nominally 13.5 V open circuit (capped at 14 V), 180 mA short circuit, and approximately 2 W maximum power, with a fixed 25 ohm load. Manual duty and Berry output span 0–100%; simulated
  0% is the panel open-circuit state.
- `src/services/MockConnector.js` is the small direct adapter used during local development; it delegates simulation to `SimpleSimulation`.
- `src/workers/simulation.worker.js` owns the same model plus the real Berry 1.1.0 interpreter and benchmark in the standalone build.
- `../packages/pv-sim` remains an independent, tested physics package, but is not used by this deliberately simple dashboard simulation.
- `src/services/EspConnector.js` connects to the ESP32 using `/ws`, `/api/set`, `/api/sweep`, and `/api/sweepdata`.
- `src/components/SimulationScene.vue` only visualizes the sky and emits environmental inputs; it is not a physical model.

## Requirements

- Node.js 20 or newer is recommended for the current Vite version.
- npm
- PlatformIO, when uploading the firmware or LittleFS image to the ESP32.

Install frontend dependencies from this folder:

```bash
cd frontend
npm install
```

## Develop Locally

Start the Vite development server:

```bash
cd frontend
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://localhost:5173
```

In this mode the dashboard automatically uses `MockConnector`, so controls, charts, and sweeps work without an ESP32 connected.

## Build For The ESP32

Create the small ESP32 build:

```bash
cd frontend
npm run build:firmware
```

The Vite config writes the built files directly into:

```text
../firmware/data
```

That directory is the LittleFS data folder served by the ESP32 firmware. The build uses relative asset paths, so the dashboard can be served from the device without a separate web server or internet connection.

This target includes the small Berry source editor used to install programs on the ESP32. It excludes the browser Berry/WASM interpreter, simulation worker, and benchmark runtime: real-mode Berry is executed and bounded by the firmware. In the real Berry view, CSV logging replaces the benchmark; the files are stored on the ESP32. The real dashboard header has a Downloads button that opens /downloads directly.

## Build The Standalone Algorithm Lab

```bash
cd frontend
npm run build:standalone
```

The generated file is `frontend/dist/edugrid-mppt.html`. It contains its scripts, styles, worker, and Berry WebAssembly runtime inline and can be opened directly with `file://`. It is not a LittleFS artifact and must not be copied into `firmware/data`.

`frontend/dist/edugrid-mppt.html` is generated output. Never edit it manually.

The simulated sweep is intentionally broader than a hardware sweep: it samples the complete model curve from 0 V/short circuit through 13.5 V/open circuit. Live operation still uses the fixed 50 ohm classroom load. The synthetic cloudy-day benchmark varies the whole panel's irradiance; it does not simulate cell-level partial shading or multiple power peaks.

## Upload To The Device

After building the frontend, upload the LittleFS image from the firmware project:

```bash
cd ../firmware
pio run -e esp32dev -t uploadfs
```

Then upload or re-upload the firmware if needed:

```bash
pio run -e esp32dev -t upload
```

For the Arduino Nano ESP32 environment, use:

```bash
pio run -e arduino_nano_esp32 -t uploadfs
pio run -e arduino_nano_esp32 -t upload
```

Once the ESP32 is running, connect to its Wi-Fi access point and open the device IP address printed in the serial monitor.

## Firmware API Used By The Dashboard

The production dashboard expects the firmware to provide:

- `GET /api/set?mode=AUTO|MANUAL`
- `GET /api/set?algo=PNO|INCCOND`
- `GET /api/set?duty=<number>`
- `GET /api/sweep`
- `GET /api/sweepdata`
- `WS /ws` for live telemetry

Telemetry packets are expected to include the current operating values. The frontend currently reads these short keys:

```json
{
  "v": 17.2,
  "c": 1.4,
  "p": 24.1,
  "d": 0.42,
  "m": "AUTO"
}
```

## Useful Commands

```bash
npm run dev               # local simulation dashboard
npm run build:firmware    # small real-board dashboard in firmware/data
npm run build:standalone  # one offline frontend/dist/edugrid-mppt.html
npm run check             # tests, both builds, isolation checks, file:// smoke test
```

## Notes

- Do not commit `node_modules`.
- Build output is generated from this frontend source.
- If the dashboard works locally but not from the ESP32, check the browser console, the serial monitor, and whether `pio run -t uploadfs` was run after the latest frontend build.
