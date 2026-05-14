# EduGrid MPPT Firmware

Firmware for the EduGrid MPPT trainer. It runs on the classic Arduino Nano and the Arduino Nano ESP32. The Nano ESP32 build also serves the WiFi dashboard from `firmware/data/`.

## Features

- Arduino Nano and Arduino Nano ESP32 support
- Student MPPT workspace in `src/mppt_alg.cpp`
- Short student API: `PV.getVoltage()`, `PV.getPower()`, `load.getVoltage()`, `duty.set()`, `duty.change()`
- Panel/input INA226 plus optional load/output INA226
- OLED telemetry with SSD1306 default and SH1106 option
- Manual duty control with button and potentiometer
- Nano ESP32 WiFi dashboard with live telemetry, manual duty, algorithm selection, and IV sweep

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

The board creates an open WiFi access point:

```text
SSID: EduGrid_MPPT
URL:  http://192.168.4.1
```

## Controls

| Input | Action |
| --- | --- |
| Short button press | Toggle Auto / Manual mode |
| Long button press | Switch Student/P&O and Incremental Conductance |
| Potentiometer | Set duty cycle in Manual mode |
| Web dashboard | Set mode, duty, algorithm, and start IV sweep |

## Student Workspace

Students should usually edit only:

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

## Serial Monitor

Use `115200` baud. Startup messages show sensor and OLED status.
