# EduGrid MPPT Firmware

Firmware for the EduGrid MPPT trainer. It runs on the classic Arduino Nano and the Arduino Nano ESP32. The Nano ESP32 build also serves the WiFi dashboard from `firmware/data/`.

## Features

- Arduino Nano and Arduino Nano ESP32 support
- Student MPPT workspace in `src/mppt_alg.cpp`
- Short student API: `PV.getVoltage()`, `PV.getPower()`, `load.getVoltage()`, `duty.set()`, `duty.change()`
- Panel/input INA226 plus optional load/output INA226
- OLED telemetry with SSD1306 default and SH1106 option
- Manual duty control with button and potentiometer
- Nano ESP32 WiFi dashboard with live telemetry, manual duty, algorithm selection, and I–V sweep
- Restricted Berry 1.1.0 student algorithms on the Nano ESP32

## Hardware

- Microcontroller: Arduino Nano ATmega328P or Arduino Nano ESP32
- Gate PWM: `D9` on classic Nano, `D5` on Nano ESP32
- Button: `D3`
- Potentiometer: `A7`
- Panel/input INA226: I2C address `0x40`
- Optional load/output INA226: I2C address `0x41`
- OLED: I2C address `0x3C`, fallback `0x3D`

Current OLED default:

```cpp
#define OLED_CONTROLLER OLED_CONTROLLER_SSD1306
```

Switch to SH1106 in `include/config.h` if your display needs it.

## Important Nano ESP32 Potentiometer Note

The Nano ESP32 analog pins are 3.3 V inputs. Do not feed a 5 V potentiometer wiper directly into an ADC pin.

For the next hardware revision:

- Power the potentiometer from `3V3` or `IOREF`, not fixed `5V`.
- If WiFi must stay on, choose an ADC pin that behaves reliably while WiFi is active.
- Keep the firmware pin in one place: `POT_PIN` in `include/config.h`.

## Build Environments

From this `firmware/` folder:

```bash
pio run -e nanoatmega328new
pio run -e arduino_nano_esp32
```

PlatformIO environments:

| Environment | Board |
| --- | --- |
| `nanoatmega328new` | Classic Arduino Nano |
| `arduino_nano_esp32` | Arduino Nano ESP32 |

The old generic `esp32dev` environment has been removed.

## Upload

Use the PlatformIO sidebar or:

```bash
pio run -e nanoatmega328new -t upload
pio run -e arduino_nano_esp32 -t upload
```

For the Nano ESP32 dashboard, also upload the filesystem image:

```bash
pio run -e arduino_nano_esp32 -t uploadfs
```

### Browser updates after the first USB installation

The Nano ESP32 firmware contains a recovery page that does not depend on the
dashboard filesystem. After one USB installation of this firmware, subsequent
application and dashboard updates can be installed over the board's WiFi:

1. Connect to the board's open `EduGrid_XX` access point.
2. Open `http://192.168.4.1/admin`; no login or password is required.
3. Upload either the application image or the LittleFS image.
4. Confirm the upload and keep the board powered until it restarts.

**Classroom access warning:** anyone connected to this open access point can replace
the firmware or filesystem. Only power it up in a supervised setting and keep
the upload files and a USB recovery path available.

Build the upload files with:

```bash
pio run -e arduino_nano_esp32
pio run -e arduino_nano_esp32 -t buildfs
```

The files are written to:

```text
.pio/build/arduino_nano_esp32/firmware.bin
.pio/build/arduino_nano_esp32/littlefs.bin
```

Firmware OTA writes to the inactive 3 MiB application slot. The Arduino framework
used by this project does not enable automatic boot rollback, so keep the initial
USB installation available until an OTA firmware has been tested on hardware. A
filesystem upload replaces the single LittleFS partition and therefore is not
power-failure atomic.
The recovery page remains available if LittleFS is damaged, so a valid filesystem
image can be uploaded again. `/student.be`, when present, is backed up to NVS and
restored after a successful filesystem update.

Before either upload starts, the firmware stops an active sweep and holds the
converter at minimum duty. The normal control loop remains disabled until the
upload fails or the board restarts.

The browser updater intentionally does not replace the bootloader or partition
table. Changes to either still require a USB connection.

The board creates an open WiFi access point whose final two hexadecimal
characters identify the individual board. Its OLED shows the network and page
addresses for the first 15 seconds after power-up, for example:

```text
EduGrid WiFi (open)
SSID: EduGrid_A3
192.168.4.1
Updates: /admin
Files: /downloads
```

## Controls

| Input | Action |
| --- | --- |
| Short button press | Toggle Auto / Manual mode |
| Long button press | Cycle Incremental Conductance and P&O; on Nano ESP32, also Student / Berry |
| Slide potentiometer | Set duty cycle in Manual mode |
| Web dashboard | Set mode, duty, algorithm, and start an I–V sweep |

## Berry on the Nano ESP32

The ESP32 dashboard can compile, install, and run the same `mppt()` Berry program
used by the standalone simulator. Select **Student / Berry**, edit the program,
then select **Install & Run**. The source is compiled on the ESP32 and the last
verified program is stored as `/student.be` in LittleFS.

The embedded runtime exposes only `PV`, `load`, and `duty`. Filesystem, OS,
network, debug, introspection, shared-library, and bytecode-file modules are
disabled. Firmware—not student code—applies the resulting duty cycle. Each call
has a 20 ms wall-clock limit, duty remains inside the configured PWM limits, and
one call can change duty by at most 0.05. A timeout, runtime error, or non-finite
duty disables execution and moves PWM to minimum duty.

Berry management API:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/berry` | Compile and atomically install a plain-text Berry program |
| `GET /api/berry` | Read installation health, diagnostics, and active source |
| `DELETE /api/berry` | Remove the active and saved student program |

A failed upload never replaces the previous valid VM or saved source. This is a
software safety boundary, not a substitute for the converter's electrical
current limiting and physical protections.

## Real-experiment CSV logging

On the ESP32 dashboard, select Real and Student / Berry. The panel provides
Start logging and Stop logging at 1 s, 30 s, 1 min, or 5 min intervals. Only
real sensor readings are recorded; the standalone simulation retains Benchmark.

Recordings are saved as /logs/run-0001.csv etc. in LittleFS. Select the
Downloads button in the real dashboard header, or open /downloads on the
device access point, to download or delete older files without a password. The CSV columns are elapsed
seconds, PV voltage (V), PV current (A), load voltage (V), load current (A),
and duty cycle (0-1). Missing load-sensor readings are blank.

CSV data is capped at 4 MiB and 64 files, with at least 256 KiB free space
reserved. At a conservative 64 bytes per row, 4 MiB holds approximately
18 hours at 1 s, 23 days at 30 s, 46 days at 1 min, or 228 days at
5 min; headers, filesystem overhead, and existing files reduce that.
Storage full or write failure stops recording. OTA closes the active CSV.
A firmware-only update normally leaves LittleFS intact; a filesystem update
replaces it and may erase all recordings. Download files you want to keep first.

Logger API: GET /api/logging returns status and file list;
POST /api/logging/start?intervalS=1|30|60|300 starts a run;
POST /api/logging/stop closes it; GET /api/logging/file?name=run-0001.csv
downloads it. DELETE on the same file URL deletes it without authentication.

## Student Workspace

On the Nano ESP32, students write and install their algorithm in the dashboard's
**Student / Berry** editor. The **P&O** selection always runs the built-in
reference controller. The C++ workspace below remains for optional source-code
exercises, but the standard firmware does not select it:

```text
src/mppt_alg.cpp
```

The short API is meant for student code:

```cpp
PV.getVoltage();
PV.getCurrent();
PV.getPower();

load.getVoltage();
load.getCurrent();
load.getPower();
load.isAvailable();

duty.get();
duty.set(0.50f);
duty.change(+smallDutyCycleStep);
```

Longer names such as `measurement.panelVoltageVolts` still work and are useful when teaching structs, but the short API is the preferred beginner path.

Important buck converter rule for this kit:

```text
Increasing duty cycle usually lowers the panel voltage.
Decreasing duty cycle usually raises the panel voltage.
```

## Measurement Filtering

The INA226 is configured for internal averaging. The extra software IIR filter is located in `src/sensor_manager.cpp`, but is disabled by default:

```cpp
#define ENABLE_SENSOR_IIR_FILTER 0
```

Enable it in `include/config.h` only if you want additional smoothing after the INA226 readings.

## Configuration

Most project settings live in:

```text
include/config.h
```

Useful settings:

| Setting | Meaning |
| --- | --- |
| `PWM_MIN_DUTY`, `PWM_MAX_DUTY` | Allowed duty cycle range |
| `DUTY_STEP_START` | Default MPPT step size |
| `VIN_VALID_MIN` | Minimum panel voltage before MPPT runs |
| `INA_AVERAGE_MODE` | INA226 internal averaging |
| `ENABLE_SENSOR_IIR_FILTER` | Optional software sensor smoothing |
| `OLED_CONTROLLER` | SSD1306 or SH1106 display driver |
| `ENABLE_WIFI_DASHBOARD` | Nano ESP32 dashboard on/off |

The active firmware and dashboard accept 0–100% duty. On the AVR board, 0%
disconnects the timer output and drives the gate low; 100% holds the PWM output
high. The ESP32 uses the pinned Arduino LEDC implementation. This range is
not a substitute for checking gate polarity and component temperatures on the
physical kit before prolonged endpoint operation.

## Serial Monitor

Use `115200` baud. Startup messages show sensor and OLED status.
