/**
 * @file sensor_manager.cpp
 * @brief Reads the panel/input and load/output INA226 sensors.
 */

#include "sensor_manager.h"
#include "config.h"
#include <INA226.h>

static INA226 panelIna226Sensor(PANEL_INA_ADDR);
static INA226 loadIna226Sensor(LOAD_INA_ADDR);

static bool panelSensorIsReady = false;
static bool loadSensorIsReady = false;
#if ENABLE_SENSOR_IIR_FILTER
static bool filterHasValue = false;
static PowerStageMeasurements filteredMeasurements;
#endif

static void calibrateIna226Sensor(INA226& sensor);
static void configureIna226Averaging(INA226& sensor);
static void readIna226Sensor(INA226& sensor,
                             float& voltageVolts,
                             float& currentAmps,
                             float& powerWatts);
static void clearMeasurements(PowerStageMeasurements& measurements);
static void clampAndCalculatePower(float& currentAmps, float voltageVolts, float& powerWatts);
static void filterMeasurements(PowerStageMeasurements& measurements);
#if ENABLE_SENSOR_IIR_FILTER
static float filterValue(float oldValue, float newValue);
#endif

bool setupSensor() {
    panelSensorIsReady = panelIna226Sensor.begin();
    loadSensorIsReady = loadIna226Sensor.begin();

    if (panelSensorIsReady) {
        calibrateIna226Sensor(panelIna226Sensor);
        configureIna226Averaging(panelIna226Sensor);
    }

    if (loadSensorIsReady) {
        calibrateIna226Sensor(loadIna226Sensor);
        configureIna226Averaging(loadIna226Sensor);
    }

    return panelSensorIsReady;
}

bool readSensors(PowerStageMeasurements& measurements) {
    measurements.panelSensorIsReady = panelSensorIsReady;
    measurements.loadSensorIsReady = loadSensorIsReady;

    clearMeasurements(measurements);

    if (!panelSensorIsReady) {
#if ENABLE_SENSOR_IIR_FILTER
        filterHasValue = false;
#endif
        return false;
    }

    readIna226Sensor(panelIna226Sensor,
                     measurements.panelVoltageVolts,
                     measurements.panelCurrentAmps,
                     measurements.panelPowerWatts);

    clampAndCalculatePower(measurements.panelCurrentAmps,
                           measurements.panelVoltageVolts,
                           measurements.panelPowerWatts);

    if (loadSensorIsReady) {
        readIna226Sensor(loadIna226Sensor,
                         measurements.loadVoltageVolts,
                         measurements.loadCurrentAmps,
                         measurements.loadPowerWatts);

        clampAndCalculatePower(measurements.loadCurrentAmps,
                               measurements.loadVoltageVolts,
                               measurements.loadPowerWatts);
    }

    filterMeasurements(measurements);

    return true;
}

bool readSensor(float &panelVoltageVolts, float &panelCurrentAmps) {
    PowerStageMeasurements measurements;
    if (!readSensors(measurements)) {
        return false;
    }

    panelVoltageVolts = measurements.panelVoltageVolts;
    panelCurrentAmps = measurements.panelCurrentAmps;
    return true;
}

static void calibrateIna226Sensor(INA226& sensor) {
    sensor.setMaxCurrentShunt(INA_MAX_CURRENT, SHUNT_OHMS);
}

static void configureIna226Averaging(INA226& sensor) {
    sensor.setAverage((uint8_t)INA_AVERAGE_MODE);
    sensor.setBusVoltageConversionTime((uint8_t)INA_CONVERSION_TIME_MODE);
    sensor.setShuntVoltageConversionTime((uint8_t)INA_CONVERSION_TIME_MODE);
    sensor.setModeShuntBusContinuous();
}

static void readIna226Sensor(INA226& sensor,
                             float& voltageVolts,
                             float& currentAmps,
                             float& powerWatts) {
    voltageVolts = sensor.getBusVoltage();
    currentAmps = sensor.getCurrent_mA() / 1000.0f;
    powerWatts = voltageVolts * currentAmps;
}

static void clearMeasurements(PowerStageMeasurements& measurements) {
    measurements.panelVoltageVolts = 0.0f;
    measurements.panelCurrentAmps = 0.0f;
    measurements.panelPowerWatts = 0.0f;

    measurements.loadVoltageVolts = 0.0f;
    measurements.loadCurrentAmps = 0.0f;
    measurements.loadPowerWatts = 0.0f;
}

static void clampAndCalculatePower(float& currentAmps, float voltageVolts, float& powerWatts) {
    if (currentAmps < IIN_VALID_MIN) {
        currentAmps = 0.0f;
    }

    powerWatts = voltageVolts * currentAmps;
}

static void filterMeasurements(PowerStageMeasurements& measurements) {
#if ENABLE_SENSOR_IIR_FILTER
    if (!filterHasValue) {
        filteredMeasurements.panelVoltageVolts = measurements.panelVoltageVolts;
        filteredMeasurements.panelCurrentAmps = measurements.panelCurrentAmps;
        filteredMeasurements.panelPowerWatts = measurements.panelPowerWatts;
        filteredMeasurements.loadVoltageVolts = measurements.loadVoltageVolts;
        filteredMeasurements.loadCurrentAmps = measurements.loadCurrentAmps;
        filteredMeasurements.loadPowerWatts = measurements.loadPowerWatts;
        filterHasValue = true;
    } else {
        filteredMeasurements.panelVoltageVolts = filterValue(filteredMeasurements.panelVoltageVolts,
                                                             measurements.panelVoltageVolts);
        filteredMeasurements.panelCurrentAmps = filterValue(filteredMeasurements.panelCurrentAmps,
                                                            measurements.panelCurrentAmps);
        filteredMeasurements.panelPowerWatts = filterValue(filteredMeasurements.panelPowerWatts,
                                                           measurements.panelPowerWatts);
        filteredMeasurements.loadVoltageVolts = filterValue(filteredMeasurements.loadVoltageVolts,
                                                            measurements.loadVoltageVolts);
        filteredMeasurements.loadCurrentAmps = filterValue(filteredMeasurements.loadCurrentAmps,
                                                           measurements.loadCurrentAmps);
        filteredMeasurements.loadPowerWatts = filterValue(filteredMeasurements.loadPowerWatts,
                                                          measurements.loadPowerWatts);
    }

    measurements.panelVoltageVolts = filteredMeasurements.panelVoltageVolts;
    measurements.panelCurrentAmps = filteredMeasurements.panelCurrentAmps;
    measurements.panelPowerWatts = filteredMeasurements.panelPowerWatts;
    measurements.loadVoltageVolts = filteredMeasurements.loadVoltageVolts;
    measurements.loadCurrentAmps = filteredMeasurements.loadCurrentAmps;
    measurements.loadPowerWatts = filteredMeasurements.loadPowerWatts;
#endif
}

#if ENABLE_SENSOR_IIR_FILTER
static float filterValue(float oldValue, float newValue) {
    return (1.0f - SENSOR_IIR_ALPHA) * oldValue + SENSOR_IIR_ALPHA * newValue;
}
#endif
