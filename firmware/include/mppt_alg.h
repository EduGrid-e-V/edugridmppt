/**
 * @file mppt_alg.h
 * @brief Student-facing Maximum Power Point Tracking interface.
 *
 * The rest of the firmware hides the hardware details:
 * - sensors are read in sensor_manager.cpp
 * - PWM is generated in pwm_manager.cpp
 * - display output is handled in display_manager.cpp
 * - WiFi and the dashboard are handled in wifi_manager.cpp
 *
 * ESP32 students normally use the Berry editor; the C++ function in
 * mppt_alg.cpp remains as an optional source-code exercise.
 */

#pragma once
#include <Arduino.h>
#include "config.h"

/**
 * @brief One filtered measurement from the solar panel.
 */
struct SolarPanelMeasurement {
    float panelVoltageVolts;      /**< Voltage at the solar panel input. */
    float panelCurrentAmps;       /**< Current flowing from the solar panel. */
    float panelPowerWatts;        /**< panelVoltageVolts * panelCurrentAmps. */
    float loadVoltageVolts;       /**< Voltage at the converter output/load. */
    float loadCurrentAmps;        /**< Current flowing into the load. */
    float loadPowerWatts;         /**< loadVoltageVolts * loadCurrentAmps. */
    bool loadSensorIsAvailable;   /**< true when the load/output INA226 is present. */
    float converterDutyCycle;     /**< Current PWM duty cycle, 0.0 to 1.0. */
};

/**
 * @brief Simple student-facing view of one measured side of the converter.
 *
 * Use PV for the solar-panel side and load for the output side:
 * PV.getVoltage(), PV.getCurrent(), PV.getPower().
 */
class MeasurementPort {
public:
    explicit MeasurementPort(bool loadSide);

    float getVoltage() const;
    float getCurrent() const;
    float getPower() const;
    bool isAvailable() const;

private:
    bool loadSide;
};

/**
 * @brief Simple student-facing duty-cycle control.
 */
class DutyControl {
public:
    float get() const;
    void set(float requestedDutyCycle) const;
    void change(float dutyCycleChange) const;
};

extern MeasurementPort PV;
extern MeasurementPort load;
extern DutyControl duty;

/**
 * @brief Resets memory used by the MPPT algorithm.
 *
 * Called when the system enters Auto mode or when the selected algorithm changes.
 */
void resetMPPT();

/**
 * @brief Runs the algorithm selected by the UI or long button press.
 */
void runSelectedMpptAlgorithm(float panelVoltageVolts,
                              float panelCurrentAmps,
                              float loadVoltageVolts,
                              float loadCurrentAmps,
                              bool loadSensorIsAvailable,
                              Algorithm selectedAlgorithm);

/**
 * @brief Optional C++ student workspace (not selected by the standard UI).
 *
 * This function is intentionally simple: it receives voltage/current/power
 * measurements and changes the duty cycle.
 */
void runStudentMpptAlgorithm(const SolarPanelMeasurement& measurement);

/**
 * @brief Sets the buck converter duty cycle.
 *
 * @param requestedDutyCycle Duty cycle from 0.0 to 1.0. The hardware layer clamps
 * it to the safe range configured in config.h.
 */
void setConverterDutyCycle(float requestedDutyCycle);

/**
 * @brief Changes the current duty cycle by a small amount.
 *
 * Positive values increase duty cycle. Negative values decrease duty cycle.
 */
void changeConverterDutyCycle(float dutyCycleChange);

/**
 * @brief Reads the current duty cycle.
 */
float getConverterDutyCycle();

// Compatibility wrappers for older code and experiments.
void mpptIncrementalConductance(float panelVoltageVolts, float panelCurrentAmps);
void mpptPerturbObserve(float panelVoltageVolts, float panelCurrentAmps);
