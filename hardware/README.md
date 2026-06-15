# EduGrid MPPT Hardware

This folder contains the KiCad hardware design files for the EduGrid MPPT trainer.

## Main Files

| File or folder | Purpose |
| --- | --- |
| `mppt.kicad_pro` | KiCad project file |
| `mppt.kicad_sch` | Schematic |
| `mppt.kicad_pcb` | PCB layout |
| `library/Library.pretty/` | Project footprints |
| `library/3dmodels/` | 3D models used by the board |
| `mppt-backups/` | KiCad backup files |

## Related Documentation

- [Student Workbook](../docs/STUDENT_WORKBOOK.md) explains the system concept and classroom experiments.
- [Firmware README](../firmware/README.md) explains the firmware, board controls, and supported build environments.

## Notes For Students

The hardware is the physical part of the MPPT system: solar panel input, buck converter power stage, INA226 sensors, OLED display, button, potentiometer, and the Arduino Nano or Arduino Nano ESP32.

When reading the schematic, try to connect each block to the firmware modules:

- Sensors in hardware are read by `firmware/src/sensor_manager.cpp`.
- The gate driver/PWM path is controlled by `firmware/src/pwm_manager.cpp`.
- Button and potentiometer are handled by `firmware/src/input_manager.cpp`.
- Display wiring is used by `firmware/src/display_manager.cpp`.

