/**
 * @file sensor_manager.h
 * @brief Sensor interface for the INA226.
 *
 * This module handles the initialization and reading of the INA226
 * voltage and current sensor.
 */

#pragma once
#include <Arduino.h>

/**
 * @brief Initializes the INA226 sensor.
 * 
 * Configures the sensor with the shunt resistor value and maximum expected current.
 * 
 * @return true if the sensor was found and initialized successfully, false otherwise.
 */
bool setupSensor();

/**
 * @brief Reads the latest voltage and current values from the sensor.
 * 
 * @param[out] vin Reference to a float where the Bus Voltage (V) will be stored.
 * @param[out] ishunt Reference to a float where the Shunt Current (A) will be stored.
 * @return true if the read was successful (and sensor is initialized), false otherwise.
 */
bool readSensor(float &vin, float &ishunt);
