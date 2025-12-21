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
 * @param pin Input Power in Watts.
 * @param vin Input Voltage in Volts.
 * @param iin Input Current in Amps.
 * @param duty Current PWM Duty Cycle (0.0 to 1.0).
 * @param mode Current operating mode (AUTO or MANUAL).
 * @param algo Current MPPT Algorithm.
 */
void displayTelemetry(float pin, float vin, float iin, float duty, Mode mode, Algorithm algo);
