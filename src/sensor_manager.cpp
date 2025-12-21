/**
 * @file sensor_manager.cpp
 * @brief Implementation of sensor interface functions.
 */

#include "sensor_manager.h"
#include "config.h"
#include <INA226.h>

/** @brief INA226 sensor instance. */
static INA226 ina226(INA_ADDR);

/** @brief Flag indicating if the sensor is successfully initialized. */
static bool ina_ok = false;

bool setupSensor() {
  ina_ok = ina226.begin();
  if (ina_ok) {
    // Calibrate the INA226. This sets the calibration register based on the shunt resistor
    // and the max expected current, allowing the chip to calculate current internally.
    ina226.setMaxCurrentShunt(INA_MAX_CURRENT, SHUNT_OHMS);
  }
  return ina_ok;
}

bool readSensor(float &vin_V, float &ishunt_A) {
  if (!ina_ok) return false;
 
  vin_V    = ina226.getBusVoltage();          // Read Bus Voltage in Volts
  ishunt_A = ina226.getCurrent_mA() / 1000.0f;  // Read Current in mA and convert to Amps
 
  return true;
}
