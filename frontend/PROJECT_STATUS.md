# EduGrid MPPT - Project Status

## Project Overview
This repository is now a combined EduGrid MPPT project with:

*   **`frontend/`**: Vue 3 + Vite dashboard served offline from ESP32 LittleFS.
*   **`firmware/`**: PlatformIO Arduino firmware for the MPPT board.
*   **`hardware/`**: PCB/library hardware files.

The dashboard communicates with the board through:

*   **WebSocket `/ws`** for live telemetry.
*   **HTTP `/api/*`** for commands such as mode changes, duty-cycle changes, algorithm selection, sweep start, and sweep data fetch.

## Frontend Status

### Dashboard Design
*   Reworked into a clean, mobile-friendly lab dashboard for high-school and early engineering students.
*   Uses the EduGrid identity in the header with a light, structured interface.
*   Graphs were rebuilt as responsive SVG charts instead of fixed canvas/uPlot layouts.
*   Graph cards now have clear light tiles, inset plot areas, readable axis labels, and mobile-friendly sizing.

### Controls
*   `ControlPanel.vue` shows:
    *   Panel/input power, voltage, current.
    *   Load/output power, voltage, current when the second INA226 is detected.
    *   Manual duty-cycle slider.
    *   Auto/manual mode selection.
    *   MPPT algorithm selection.
    *   Sweep trigger.
*   Fixed the manual duty slider reset issue:
    *   Missing telemetry fields no longer reset duty to `0`.
    *   Missing telemetry mode no longer forces `MANUAL`.
    *   Firmware now sends duty/mode/algorithm with live telemetry.

### Telemetry Parsing
*   `EspConnector.js` normalizes panel-side values:
    *   `v`, `i`/`c`, `p`
*   It also normalizes load-side values:
    *   `loadV`, `loadI`, `loadP`, `loadSensor`
*   Sweep data can now include load-side arrays as well.

### Mock Mode
*   `MockConnector.js` simulates:
    *   PV panel behavior.
    *   MPPT movement.
    *   Load/output-side readings for development without hardware.

## Firmware Status

### Educational Refactor
The firmware was refactored so students mainly work in:

```text
firmware/src/mppt_alg.cpp
```

The rest of the firmware abstracts hardware details:

*   `sensor_manager.*`: INA226 readings.
*   `pwm_manager.*`: PWM/duty-cycle output.
*   `display_manager.*`: OLED display.
*   `wifi_manager.*`: dashboard API and WebSocket.
*   `sweep_manager.*`: sweep scan and sweep data.
*   `input_manager.*`: button and potentiometer.

### Student MPPT Interface
`mppt_alg.cpp` now contains a clearly marked section:

```cpp
/*
 * ##### YOUR CODE GOES HERE #####
 */
```

Students receive a readable measurement object:

```cpp
measurement.panelVoltageVolts
measurement.panelCurrentAmps
measurement.panelPowerWatts
measurement.loadVoltageVolts
measurement.loadCurrentAmps
measurement.loadPowerWatts
measurement.loadSensorIsAvailable
measurement.converterDutyCycle
```

Students can control the converter with:

```cpp
getConverterDutyCycle()
setConverterDutyCycle(0.50f)
changeConverterDutyCycle(+smallDutyCycleStep)
changeConverterDutyCycle(-smallDutyCycleStep)
```

`P&O` currently maps to the student/example algorithm area. `IncCond` remains available as a reference implementation.

### Main Loop Cleanup
`main.cpp` now uses verbose variable names such as:

*   `filteredPanelVoltageVolts`
*   `filteredPanelCurrentAmps`
*   `filteredPanelPowerWatts`
*   `filteredLoadVoltageVolts`
*   `filteredLoadCurrentAmps`
*   `filteredLoadPowerWatts`
*   `currentTimeMilliseconds`

The loop is split into readable helper functions for input handling, soft start, sensor filtering, dashboard telemetry, and auto/manual control.

### Second INA226 Support
The new board revision with a second INA226 is supported.

Default addresses in `firmware/include/config.h`:

```cpp
#define PANEL_INA_ADDR  0x40
#define LOAD_INA_ADDR   0x41
```

The panel/input INA226 is required for MPPT. The load/output INA226 is optional:

*   If detected, its voltage/current/power are displayed and sent to the dashboard.
*   If not detected, the firmware still runs and reports `loadSensor = false`.

### Dashboard Telemetry
Live WebSocket telemetry now includes:

```json
{
  "v": 0,
  "i": 0,
  "p": 0,
  "loadV": 0,
  "loadI": 0,
  "loadP": 0,
  "loadSensor": true,
  "d": 0,
  "m": "AUTO",
  "algo": "PNO"
}
```

This fixed frontend state synchronization for:

*   Manual duty slider.
*   Auto/manual mode display.
*   Algorithm display.

## Build And Upload Workflow

From repository root:

```bash
cd frontend
npm run build
```

Vite writes directly into:

```text
firmware/data/
```

This is configured in:

```text
frontend/vite.config.js
```

with:

```js
build: {
  outDir: '../firmware/data',
  emptyOutDir: true,
}
```

Then upload the filesystem and firmware from:

```bash
cd ../firmware
pio run -e arduino_nano_esp32 -t uploadfs
pio run -e arduino_nano_esp32 -t upload
```

PlatformIO expects the project folder to be `firmware/`, because `platformio.ini` lives there.

## Verified Builds

The following commands pass:

```bash
pio run -e arduino_nano_esp32
pio run -e nanoatmega328new
npm run build
```

## Known Issue

Uploading to the Arduino Nano ESP32 on Ubuntu still fails intermittently/currently with:

```text
Failed to connect to ESP32-S3: No serial data received.
```

Notes:

*   The board is detected as `/dev/ttyACM0`.
*   Updating esptool from 4.7 to 5.2 was tested and did not fix the upload issue.
*   The esptool change was reverted; PlatformIO is back to its normal `tool-esptoolpy @ 1.40700.0 (4.7.0)`.
*   PlatformIO warns that `/etc/udev/rules.d/99-platformio-udev.rules` are outdated.
*   Likely next steps are fixing udev rules and/or manually entering bootloader mode before upload.

## Current Next Steps

1.  Resolve Arduino Nano ESP32 upload/bootloader issue on Ubuntu.
2.  Test second INA226 on the new board revision and confirm `LOAD_INA_ADDR`.
3.  Add live sweep progress over WebSocket so the dashboard can show the sweep dot moving during the scan.
4.  Consider a student worksheet/example around the `##### YOUR CODE GOES HERE #####` section.
