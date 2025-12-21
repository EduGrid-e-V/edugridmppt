/**
 * @file input_manager.h
 * @brief Input handling module.
 *
 * This module handles user inputs from the button and potentiometer.
 * It includes debouncing for the button and smoothing/scaling for the potentiometer.
 */

#pragma once
#include <Arduino.h>
#include "config.h"

/** @brief Types of button events. */
enum ButtonEvent {
    BTN_NONE = 0,       /**< No event */
    BTN_SHORT_PRESS,    /**< Short press (< 2s) */
    BTN_LONG_PRESS      /**< Long press (> 2s) */
};

/**
 * @brief Initializes input pins.
 * 
 * Configures the button pin as INPUT_PULLUP and initializes the potentiometer smoothing.
 */
void setupInputs();

/**
 * @brief Checks for button events (Short Press / Long Press).
 * 
 * Handles debouncing and press duration logic.
 * 
 * @param now The current system time in milliseconds.
 * @return The detected button event (BTN_NONE, BTN_SHORT_PRESS, or BTN_LONG_PRESS).
 */
ButtonEvent checkButtonEvent(unsigned long now);

/**
 * @brief Reads and processes the potentiometer value for manual duty cycle control.
 * 
 * Performs oversampling, IIR smoothing, and optional auto-calibration.
 * Maps the raw ADC value to the allowed duty cycle range (PWM_MIN_DUTY to PWM_MAX_DUTY).
 * The result is rounded to the nearest whole percent to provide stable output.
 * 
 * @return The calculated duty cycle as a float (0.0 to 1.0).
 */
float readManualDuty();
