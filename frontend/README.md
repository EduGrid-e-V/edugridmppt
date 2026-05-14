# EduGrid MPPT Dashboard

This is the browser dashboard for the EduGrid MPPT trainer. It is a Vue 3 + Vite app that can run in two modes:

- Development mode uses a local mock MPPT simulation, so the interface can be built and tested without hardware.
- Production mode is served by the ESP32 from LittleFS and talks to the firmware through WebSockets and HTTP endpoints.

The built dashboard is intentionally self-contained. It should not rely on external CDNs because the ESP32 usually serves it from its own access point.

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

- `src/services/MockConnector.js` provides simulated voltage, current, power, duty cycle, and sweep data during local development.
- `src/services/EspConnector.js` connects to the ESP32 using `/ws`, `/api/set`, `/api/sweep`, and `/api/sweepdata`.
- `src/services/index.js` chooses the mock connector in Vite development mode and the ESP32 connector in production builds.

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

Create a production build:

```bash
cd frontend
npm run build
```

The Vite config writes the built files directly into:

```text
../firmware/data
```

That directory is the LittleFS data folder served by the ESP32 firmware. The build uses relative asset paths, so the dashboard can be served from the device without a separate web server or internet connection.

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
npm run dev      # local mock dashboard
npm run build    # production files for firmware/data
npm run preview  # preview the production build locally
```

## Notes

- Do not commit `node_modules`.
- Build output is generated from this frontend source.
- If the dashboard works locally but not from the ESP32, check the browser console, the serial monitor, and whether `pio run -t uploadfs` was run after the latest frontend build.
