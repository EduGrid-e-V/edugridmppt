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

/**
 * @brief Reads the raw potentiometer ADC value after oversampling.
 *
 * This is mostly useful for diagnostics. With the configured ADC resolution,
 * the expected range is 0..1023.
 */
int readPotentiometerRaw();

/**
 * @brief Stores the current potentiometer position as the "not moved yet" reference.
 *
 * Call this when another input source, such as the web slider, takes control of
 * the duty cycle. The potentiometer will only take control back after it moves
 * away from this reference position.
 */
void rememberCurrentPotentiometerPositionAsBaseline();

/**
 * @brief Reads the potentiometer and reports whether it moved enough to take over.
 *
 * @param manualDutyCycle Receives the duty cycle from the potentiometer.
 * @return true when the potentiometer moved by at least POT_TAKEOVER_THRESHOLD.
 */
bool readManualDutyIfPotentiometerMoved(float &manualDutyCycle);
