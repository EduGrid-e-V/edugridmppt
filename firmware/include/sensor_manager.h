/**
 * @file sensor_manager.h
 * @brief Simple interface for the INA226 voltage/current sensors.
 *
 * The board can have two INA226 sensors:
 * - panel/input side: measures the solar panel
 * - load/output side: measures the converter output/load
 */

#pragma once
#include <Arduino.h>

struct PowerStageMeasurements {
    float panelVoltageVolts;
    float panelCurrentAmps;
    float panelPowerWatts;

    float loadVoltageVolts;
    float loadCurrentAmps;
    float loadPowerWatts;

    bool panelSensorIsReady;
    bool loadSensorIsReady;
};

/**
 * @brief Initializes both INA226 sensors.
 *
 * @return true when the panel/input INA226 is ready. The load/output INA226 is optional.
 */
bool setupSensor();

/**
 * @brief Reads both INA226 sensors.
 *
 * The panel/input sensor is required for MPPT. The load/output sensor is optional;
 * its values are set to zero when it is not detected.
 */
bool readSensors(PowerStageMeasurements& measurements);

/**
 * @brief Backward-compatible helper for older experiments.
 */
bool readSensor(float &panelVoltageVolts, float &panelCurrentAmps);
