/**
 * @file display_manager.h
 * @brief OLED Display management module.
 *
 * This module handles the initialization and updating of the SH1106 OLED display.
 * It provides functions to show a splash screen and real-time telemetry data.
 */

#pragma once

#include <Arduino.h>
#include "config.h"

/**
 * @brief Initializes the OLED display.
 * 
 * Sets up the I2C communication with the display and shows the splash screen.
 */
void setupDisplay();

/**
 * @brief Displays the startup splash screen.
 * 
 * Shows system information such as the selected algorithm, sensor address,
 * PWM frequency, and shunt resistor value.
 */
void displaySplash();

/**
 * @brief Updates the display with current telemetry data.
 * 
 * @param panelPowerWatts Solar panel power in Watts.
 * @param panelVoltageVolts Solar panel voltage in Volts.
 * @param panelCurrentAmps Solar panel current in Amps.
 * @param loadPowerWatts Load/output power in Watts.
 * @param loadVoltageVolts Load/output voltage in Volts.
 * @param loadCurrentAmps Load/output current in Amps.
 * @param LoadSensorAvailable true when the load/output INA226 was detected.
 * @param converterDutyCycle Current PWM duty cycle (0.0 to 1.0).
 * @param operatingMode Current operating mode (AUTO or MANUAL).
 * @param selectedAlgorithm Current MPPT algorithm.
 */
void displayTelemetry(float panelPowerWatts,
                      float panelVoltageVolts,
                      float panelCurrentAmps,
                      float loadPowerWatts,
                      float loadVoltageVolts,
                      float loadCurrentAmps,
                      bool LoadSensorAvailable,
                      float converterDutyCycle,
                      Mode operatingMode,
                      Algorithm selectedAlgorithm);
