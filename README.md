# EduGrid MPPT

EduGrid MPPT is an educational Maximum Power Point Tracking trainer with firmware, hardware files, and an optional WiFi dashboard for the Arduino Nano ESP32.

The current firmware supports two PlatformIO environments:

- `nanoatmega328new` for the classic Arduino Nano
- `arduino_nano_esp32` for the Arduino Nano ESP32

Students normally work in [firmware/src/mppt_alg.cpp](firmware/src/mppt_alg.cpp), using the short API:

```cpp
PV.getVoltage();
PV.getCurrent();
PV.getPower();
load.getVoltage();
duty.get();
duty.set(0.50f);
duty.change(+smallDutyCycleStep);
```

Start here:

- [Student Workbook](docs/STUDENT_WORKBOOK.md) - guided introduction to coding, the firmware structure, solar panel behavior, buck converters, and MPPT algorithms.
- [Firmware README](firmware/README.md) - build/upload notes, board controls, and hardware notes.
