# EduGrid MPPT Student Workbook

This workbook introduces the EduGrid MPPT project to students who are new to both coding and Maximum Power Point Tracking. It is meant to work in class with a teacher nearby, but it also gives ambitious students enough structure to continue at home.

The most important student file is:

```text
firmware/src/mppt_alg.cpp
```

Most experiments begin there. The rest of the firmware reads sensors, drives the converter, updates the display, and serves the optional Nano ESP32 dashboard.

## How To Use This Workbook

Use this document as a guided path:

1. Read the concept section before touching code.
2. Open the matching source files while reading the code tour.
3. Run the experiments in order.
4. Write observations after each experiment.
5. Change only one thing at a time, then test.

Teacher pacing idea:

| Lesson | Main goal | Suggested activity |
| --- | --- | --- |
| 1 | Understand voltage, current, power, and PWM | Manual duty cycle experiment |
| 2 | Understand the firmware structure | Trace `setup()` and `loop()` |
| 3 | Learn basic C++ ideas | Functions, variables, structs, enums |
| 4 | Build a first MPPT algorithm | Perturb and Observe |
| 5 | Compare algorithms | P&O vs Incremental Conductance |
| 6 | Investigate real solar behavior | IV sweep, shading, changing light |

Safety notes:

- Do not exceed the voltage/current limits given by the teacher.
- Do not short the solar panel or output load unless the teacher explicitly sets up that experiment.
- If measurements look strange, stop changing code and check wiring first.
- MPPT code can move the converter quickly. Use small duty cycle steps.

## 1. The Big Picture

EduGrid MPPT is a small solar power electronics trainer. A solar panel provides electrical power. A buck converter changes how the panel is loaded. A microcontroller measures voltage and current, then changes the converter's PWM duty cycle to search for the highest panel power.

![EduGrid MPPT system overview](assets/system-overview.svg)

There are two paths in the system:

- Energy path: solar panel -> buck converter -> load.
- Information path: sensors -> microcontroller -> algorithm -> PWM command.

The MPPT algorithm does not directly "pull power" from the sun. It changes the duty cycle, observes what happened to voltage/current/power, then chooses the next duty cycle.

## 2. Solar Panel Basics

A solar panel is not like an ideal battery. Its voltage and current change depending on light, temperature, and load.

Three quantities matter all the time:

| Quantity | Symbol | Unit | Meaning |
| --- | --- | --- | --- |
| Voltage | `V` | volts | Electrical pressure |
| Current | `I` | amps | Flow of charge |
| Power | `P` | watts | Energy per second |

The key equation is:

```text
Power = Voltage x Current
P = V x I
```

Example:

```text
5.0 V x 0.12 A = 0.60 W
```

The maximum power point is the place on the panel curve where `V x I` is largest.

![Solar panel IV and PV curve](assets/iv-pv-curve.svg)

Important idea:

- At very low panel voltage, current can be high but voltage is too low, so power is not maximum.
- At very high panel voltage, voltage is high but current can drop, so power is not maximum.
- Somewhere in between, voltage and current make the best product.

MPPT means Maximum Power Point Tracking. Tracking means the best point can move when the light changes, the panel is shaded, or temperature changes.

## 3. Buck Converter and PWM

The EduGrid board uses a buck converter. A buck converter is a switching circuit that transfers power using a MOSFET, inductor, diode or synchronous switch, capacitors, and a load.

The microcontroller controls the converter using PWM, which stands for Pulse Width Modulation. PWM rapidly turns a pin ON and OFF. The duty cycle says what fraction of the time the signal is ON.

```text
Duty cycle = ON time / total period
```

Examples:

| Duty cycle | Meaning |
| --- | --- |
| `0.10` | ON for 10 percent of each cycle |
| `0.50` | ON for 50 percent of each cycle |
| `0.90` | ON for 90 percent of each cycle |

![PWM duty cycle](assets/duty-cycle.svg)

Important project rule from `firmware/src/mppt_alg.cpp`:

```cpp
// Increasing duty cycle usually lowers the panel voltage.
// Decreasing duty cycle usually raises the panel voltage.
```

That rule matters when writing an algorithm. If the algorithm decides the panel voltage should go up, it will usually decrease the duty cycle on this kit.

## 4. What Is In The Repository?

The repo has three main areas:

```text
firmware/   Code that runs on Arduino Nano or Arduino Nano ESP32
frontend/   Web dashboard source for the Nano ESP32 build
hardware/   KiCad hardware design files
```

Inside `firmware/`, the important folders are:

```text
firmware/src/       C++ source files
firmware/include/   C++ header files
firmware/data/      Files served by the Nano ESP32 web dashboard
firmware/docs/      Existing firmware images/documentation assets
```

Core firmware files:

| File | Job |
| --- | --- |
| `firmware/src/main.cpp` | Connects everything together and runs the main loop |
| `firmware/src/mppt_alg.cpp` | Student MPPT workspace |
| `firmware/include/mppt_alg.h` | Student-facing MPPT types and function declarations |
| `firmware/src/sensor_manager.cpp` | Reads INA226 voltage/current sensors |
| `firmware/src/pwm_manager.cpp` | Creates PWM and stores the duty cycle |
| `firmware/src/input_manager.cpp` | Reads button and potentiometer |
| `firmware/src/display_manager.cpp` | Updates the OLED |
| `firmware/src/wifi_manager.cpp` | Nano ESP32 web server and dashboard data |
| `firmware/src/sweep_manager.cpp` | Nano ESP32 IV curve sweep |
| `firmware/include/config.h` | Pin numbers, timing, limits, and settings |

## 5. Build And Upload

This project uses PlatformIO.

Common environments from `firmware/platformio.ini`:

| Environment | Board |
| --- | --- |
| `nanoatmega328new` | Classic Arduino Nano |
| `arduino_nano_esp32` | Arduino Nano ESP32 |

From a terminal in `firmware/`, a build looks like:

```bash
pio run -e nanoatmega328new
```

For Nano ESP32 dashboard builds, the filesystem must also be uploaded so the board can serve `firmware/data/index.html` and its assets.

```bash
pio run -e arduino_nano_esp32 -t uploadfs
```

## 6. Coding Basics For This Project

This section explains the C++ ideas you will see in the firmware.

### 6.1 Comments

Comments explain code to humans. The compiler ignores them.

```cpp
// This is a one-line comment.

/*
 * This is a longer comment.
 */
```

Good comments explain why something exists. The firmware uses comments to tell students where to edit and what hardware rule matters.

### 6.2 Variables

A variable stores a value.

```cpp
float PanelVoltage = 0.0f;
```

Read it like a sentence:

- `float` means the value can contain decimals.
- `PanelVoltage` is the name.
- `0.0f` is the starting value.

Common types:

| Type | Example | Use |
| --- | --- | --- |
| `int` | `int dutyPercent = 50;` | Whole numbers |
| `float` | `float powerWatts = 0.6f;` | Decimal numbers |
| `bool` | `bool loadSensorIsAvailable = false;` | True/false values |
| `unsigned long` | `unsigned long now = millis();` | Large positive timing values |

### 6.3 Functions

A function is a named block of code that does a job.

```cpp
float currentDutyCycle = duty.get();
```

Read this line:

- `float` means the value can contain decimals.
- `currentDutyCycle` is a new variable.
- `duty.get()` calls a helper function that reads the current PWM duty cycle.

A helper call with a parameter:

```cpp
duty.set(0.50f);
```

Read it like this:

- `duty.set(...)` changes the converter duty cycle.
- `0.50f` means 50 percent duty cycle.
- The hardware layer still clamps the value to the safe range from `config.h`.

Why functions are useful:

- They give names to jobs.
- They make code easier to test and discuss.
- They hide details. Students can call `duty.change(...)` without knowing timer register details.

### 6.4 Header Files And Source Files

C++ projects often split code into two file types:

| File type | Example | Purpose |
| --- | --- | --- |
| Header | `firmware/include/mppt_alg.h` | Announces types and functions |
| Source | `firmware/src/mppt_alg.cpp` | Contains the actual function code |

The line below includes declarations from the header:

```cpp
#include "mppt_alg.h"
```

Think of a header as a menu. It tells other files what functions are available. The `.cpp` file is the kitchen where the work happens.

### 6.5 Structs

A `struct` groups related values together.

From `firmware/include/mppt_alg.h`:

```cpp
struct SolarPanelMeasurement {
    float panelVoltageVolts;
    float panelCurrentAmps;
    float panelPowerWatts;
    float loadVoltageVolts;
    float loadCurrentAmps;
    float loadPowerWatts;
    bool loadSensorIsAvailable;
    float converterDutyCycle;
};
```

Without a struct, a function might need many separate parameters. With a struct, one measurement package can travel through the program.

Example use:

```cpp
measurement.panelPowerWatts
```

The dot means "open this struct and get this field."

### 6.6 Enums

An `enum` gives names to a small set of choices.

From `firmware/include/config.h`:

```cpp
enum Mode : uint8_t {
    MODE_AUTO = 0,
    MODE_MANUAL = 1
};
```

This is clearer than using mysterious numbers:

```cpp
if (mode == MODE_AUTO) {
    // Run MPPT
}
```

### 6.7 `static` Variables

Some variables in `mppt_alg.cpp` remember values between function calls:

```cpp
static float previousPanelPowerWatts = 0.0f;
```

`static` at file level means the variable belongs only to that file. Other files cannot directly use it. This is useful for algorithm memory.

For MPPT, memory matters because the algorithm asks:

```text
Was power higher or lower than last time?
```

### 6.8 `const` Values

`const` means a value should not change after it is created.

```cpp
const float smallDutyCycleStep = DUTY_STEP_START;
```

This tells readers that `smallDutyCycleStep` is a setting, not a value that the algorithm should rewrite during normal operation.

## 7. How The Firmware Runs

Arduino-style firmware has two famous functions:

```cpp
void setup() {
    // Runs once after reset.
}

void loop() {
    // Runs again and again forever.
}
```

In EduGrid:

- `setup()` starts serial output, inputs, I2C, sensors, display, PWM, the optional Nano ESP32 WiFi dashboard, and the initial duty cycle.
- `loop()` keeps checking time, input, sensors, dashboard, algorithm, and display.

![Firmware code flow](assets/code-flow.svg)

The firmware uses `millis()` timers instead of stopping for long delays. This lets several jobs happen regularly:

| Job | Timing setting |
| --- | --- |
| MPPT control loop | `MPPT_PERIOD_MS` |
| Display update | `DISPLAY_PERIOD_MS` |
| Wait after PWM change before reading sensor | `INA_SETTLE_MS` |
| Soft-start after boot | `SOFTSTART_MS` |

## 8. Code Tour

### 8.1 `main.cpp`: The Traffic Controller

`firmware/src/main.cpp` connects modules together.

Important global state:

```cpp
Mode mode = MODE_AUTO;
Algorithm currentAlgorithm = (Algorithm)DEFAULT_MPPT_ALGORITHM;
```

This means the system starts in automatic mode and uses the default algorithm from `config.h`.

The main loop does these jobs:

1. Handle WiFi if running on Nano ESP32.
2. Check button input.
3. Respond to mode changes.
4. Run soft-start during startup.
5. Read measurements every MPPT period.
6. Send measurements to the dashboard.
7. Run automatic MPPT or manual duty control.
8. Update the OLED display.

The most important decision:

```cpp
if (mode == MODE_AUTO) {
    runSelectedMpptAlgorithm(...);
} else {
    float manualDutyCycleFromKnob = readManualDuty();
    setConverterDutyCycle(manualDutyCycleFromKnob);
}
```

In Auto mode, the algorithm controls duty cycle. In Manual mode, the knob or web control does.

### 8.2 `sensor_manager.cpp`: Measuring The World

The sensor manager talks to INA226 sensors.

The project can use:

- Panel/input sensor at `PANEL_INA_ADDR`.
- Optional load/output sensor at `LOAD_INA_ADDR`.

The main function is:

```cpp
bool readSensors(PowerStageMeasurements& measurements)
```

The `&` means the function receives the actual measurement struct and fills it in. It does not receive a copy.

The sensor manager sets values to zero before reading. That makes missing optional data predictable.

The INA226 does internal averaging. There is also an optional software IIR filter inside `sensor_manager.cpp`, controlled by:

```cpp
#define ENABLE_SENSOR_IIR_FILTER 0
```

It is disabled by default, so students normally see the direct INA226 readings.

### 8.3 `pwm_manager.cpp`: Changing The Converter

The PWM manager stores the current duty cycle:

```cpp
static float _duty = PWM_MIN_DUTY;
```

When code calls:

```cpp
duty.set(0.50f);
```

the student-facing helper asks the PWM manager to:

1. Clamp the value between `PWM_MIN_DUTY` and `PWM_MAX_DUTY`.
2. Convert the float duty cycle into an 8-bit PWM value from 0 to 255.
3. Write the PWM value to the correct hardware output.
4. Remember when the duty cycle changed.

Clamping is important. If a student accidentally requests `2.0`, the hardware layer limits it to the configured maximum.

### 8.4 `input_manager.cpp`: Human Controls

The input manager reads:

- Button: short press toggles Auto/Manual.
- Button: long press changes algorithm.
- Potentiometer: manual duty cycle control.

It also uses debouncing. A real button can electrically bounce between pressed and not pressed for a few milliseconds. Debouncing prevents one physical press from being counted many times.

Hardware note for the Nano ESP32: analog inputs are 3.3 V inputs. The potentiometer should be powered from `3V3` or `IOREF`, not fixed `5V`.

### 8.5 `display_manager.cpp`: OLED Telemetry

The display manager shows:

- Panel power.
- Panel voltage and current.
- Load voltage/current/power if the load sensor exists.
- Duty cycle.
- Mode and algorithm.

This gives quick feedback even without the web dashboard.

### 8.6 `wifi_manager.cpp` And `sweep_manager.cpp`: Nano ESP32 Features

On the Nano ESP32 build, the board creates a WiFi access point named:

```text
EduGrid_MPPT
```

The web dashboard can:

- Read live voltage/current/power.
- Switch modes.
- Select algorithms.
- Set manual duty.
- Start an IV sweep.

The sweep temporarily takes manual control, steps through duty cycle values, records measurements, then sends curve data to the dashboard.

## 9. The Student MPPT Workspace

Open:

```text
firmware/src/mppt_alg.cpp
```

The main student function is:

```cpp
void runStudentMpptAlgorithm(const SolarPanelMeasurement& measurement)
```

This function receives one measurement. It can then change the converter duty cycle.

Useful short API:

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
duty.change(-smallDutyCycleStep);
```

The longer struct names still work when you want to teach how data is packaged:

```cpp
measurement.panelVoltageVolts;
measurement.panelCurrentAmps;
measurement.panelPowerWatts;
measurement.loadVoltageVolts;
measurement.loadCurrentAmps;
measurement.loadPowerWatts;
measurement.loadSensorIsAvailable;
measurement.converterDutyCycle;
```

The existing example is a simple Perturb and Observe algorithm:

```cpp
if (changeInPanelPowerWatts < 0.0f) {
    lastDutyCycleDirection = -lastDutyCycleDirection;
}

duty.change(lastDutyCycleDirection * smallDutyCycleStep);
```

In words:

1. Compare new power to previous power.
2. If power decreased, reverse direction.
3. Move duty cycle one small step.
4. Remember this measurement for next time.

![Perturb and Observe flowchart](assets/perturb-observe.svg)

## 10. MPPT Algorithms

### 10.1 Manual Search

Before writing automatic MPPT code, use Manual mode.

Turn the potentiometer slowly and write down:

| Duty | Panel voltage | Panel current | Panel power | Observation |
| --- | --- | --- | --- | --- |
| 10 percent | | | | |
| 20 percent | | | | |
| 30 percent | | | | |
| 40 percent | | | | |
| 50 percent | | | | |
| 60 percent | | | | |
| 70 percent | | | | |
| 80 percent | | | | |
| 90 percent | | | | |

Questions:

- At which duty cycle was power highest?
- What happened to panel voltage as duty cycle increased?
- Was the curve smooth or noisy?
- Did the best duty cycle change when light changed?

### 10.2 Perturb And Observe

Perturb means "change something a little." Observe means "measure what happened."

P&O logic:

```text
Change duty a little.
If power went up, continue in the same direction.
If power went down, reverse direction.
Repeat forever.
```

Strengths:

- Simple.
- Easy to explain.
- Works well enough for many demonstrations.

Weaknesses:

- It wiggles around the maximum power point.
- It can be confused by fast light changes.
- Step size is a tradeoff: large steps react faster but waste more power by oscillating.

### 10.3 Incremental Conductance

The reference Incremental Conductance algorithm is also in `mppt_alg.cpp`.

It uses a mathematical fact:

```text
P = V x I
```

At the top of the power curve, the slope is nearly zero:

```text
dP/dV = 0
```

With calculus, this becomes:

```text
dI/dV = -I/V
```

The firmware compares:

- Incremental conductance: change in current divided by change in voltage.
- Instantaneous conductance: current divided by voltage.

You do not need to master calculus to use the idea:

- If the algorithm is left of the maximum, move one way.
- If it is right of the maximum, move the other way.
- If it is close enough, hold duty cycle.

## 11. Experiments

### Experiment 1: Find The Maximum By Hand

Goal: understand the power curve before coding.

Steps:

1. Upload the firmware.
2. Switch to Manual mode with a short button press.
3. Slowly change the potentiometer.
4. Record voltage, current, power, and duty cycle.
5. Plot power versus duty cycle.

Expected learning:

- The best duty cycle is not always the lowest or highest.
- Power measurements can be noisy.
- The maximum can move.

### Experiment 2: Trace One Loop

Goal: understand how one measurement reaches the student algorithm.

Fill in the blanks:

```text
main.cpp reads sensors by calling __________________________.
Measurements are stored in a struct named __________________.
The selected algorithm is called by ________________________.
The student function receives a ____________________________.
The duty cycle is changed by calling _______________________.
```

Answer key:

```text
readSensors(sample)
PowerStageMeasurements
runSelectedMpptAlgorithm(...)
SolarPanelMeasurement
duty.change(...) or duty.set(...)
```

### Experiment 3: Change Step Size

Goal: see how step size affects tracking.

In `firmware/include/config.h`, find:

```cpp
#define DUTY_STEP_START 0.01f
```

Try different values with teacher approval:

| Step size | Behavior near maximum | Behavior after light changes |
| --- | --- | --- |
| `0.002f` | | |
| `0.005f` | | |
| `0.010f` | | |
| `0.020f` | | |

Questions:

- Which step size is smoothest?
- Which step size reacts fastest?
- Which step size gives the best average power?

### Experiment 4: Write P&O From Scratch

Goal: rebuild the example algorithm using your own words and code.

Rules:

- Edit only inside the student section of `runStudentMpptAlgorithm`.
- Keep `rememberMeasurement(measurement);` after the student section.
- Use `duty.change(...)` instead of writing PWM registers.
- Start with small steps.

Pseudocode:

```text
if power got smaller:
    reverse direction

move duty cycle in current direction
```

Challenge:

Add a deadband so the algorithm ignores tiny power changes caused by noise.

Hint:

```cpp
if (fabsf(changeInPanelPowerWatts) > 0.002f) {
    // respond only when the change is large enough
}
```

### Experiment 5: Compare P&O And Incremental Conductance

Goal: compare two algorithms under the same conditions.

Steps:

1. Run the student P&O algorithm.
2. Record how quickly it finds the maximum after a light change.
3. Long-press the button to switch algorithms.
4. Run the reference Incremental Conductance algorithm.
5. Repeat the same light change.

Observation table:

| Algorithm | Fast to react? | Stable near max? | Confused by shading? | Notes |
| --- | --- | --- | --- | --- |
| P&O | | | | |
| IncCond | | | | |

### Experiment 6: Use The Nano ESP32 Dashboard

Goal: see live data and IV curves.

Nano ESP32 steps:

1. Build and upload the `arduino_nano_esp32` environment.
2. Upload the filesystem image.
3. Connect a phone or laptop to the `EduGrid_MPPT` WiFi network.
4. Open `http://192.168.4.1`.
5. Start an IV sweep.

Questions:

- Does the plotted power curve match your manual measurements?
- Where is the maximum power point?
- What changes when the panel is partly shaded?

## 12. Debugging Checklist

When something does not work, check from simple to complex.

Power and wiring:

- Is the solar panel connected with correct polarity?
- Is the load connected?
- Is the USB cable connected for programming and serial output?
- Are sensor wires connected to I2C?

Software:

- Did the correct PlatformIO environment build?
- Did upload finish successfully?
- Is Serial Monitor set to `115200` baud?
- Are you editing `firmware/src/mppt_alg.cpp`, not an old copy?

Measurements:

- If panel voltage is below `VIN_VALID_MIN`, firmware holds minimum duty.
- If the panel INA226 is missing, MPPT cannot run.
- If the load INA226 is missing, panel MPPT can still run; load values are shown as unavailable.

Algorithm:

- Is the step size too large?
- Did you accidentally reverse the duty rule?
- Did you remember that increasing duty usually lowers panel voltage on this kit?
- Did your code handle the first measurement?

## 13. Mini Glossary

| Term | Meaning |
| --- | --- |
| ADC | Analog-to-digital converter; reads a voltage as a number |
| Algorithm | A repeatable set of steps for solving a problem |
| Buck converter | Switching converter that usually reduces voltage |
| Duty cycle | Fraction of each PWM cycle spent ON |
| Firmware | Code that runs on a microcontroller |
| Function | Named block of code that performs a job |
| I2C | Communication bus used by sensors and display |
| INA226 | Sensor chip that measures voltage and current |
| MPPT | Maximum Power Point Tracking |
| PWM | Pulse Width Modulation |
| Struct | C++ type that groups related values |

## 14. Suggested Student Milestones

Beginner milestone:

- Build and upload the firmware.
- Explain `setup()` and `loop()`.
- Use Manual mode to find a high-power duty cycle.
- Identify voltage, current, power, and duty cycle on the display.

Intermediate milestone:

- Explain what `SolarPanelMeasurement` stores.
- Modify the P&O algorithm safely.
- Compare at least two duty step sizes.
- Explain why the algorithm needs previous measurements.

Advanced milestone:

- Add a noise deadband.
- Create an adaptive step size.
- Compare P&O and Incremental Conductance using dashboard data.
- Explain how shading changes the IV and PV curves.

## 15. Exporting This Workbook

GitLab will render this Markdown file directly, including the SVG diagrams.

PDF options:

- In GitLab or a browser, open this file and use Print -> Save as PDF.
- With Pandoc installed, run from the repo root:

```bash
pandoc docs/STUDENT_WORKBOOK.md -o EduGrid_MPPT_Student_Workbook.pdf
```

For best PDF results, keep the `docs/assets/` folder next to this workbook so the diagram links still resolve.
