/**
 * @file pwm_manager.h
 * @brief PWM control module for the Buck converter.
 *
 * This module handles the configuration of Timer1 for high-frequency PWM generation
 * and provides functions to set and retrieve the duty cycle.
 */

#pragma once
#include <Arduino.h>

/**
 * @brief Configures Timer1 for Fast PWM mode at ~31.25 kHz.
 * 
 * Sets up the ATMega328P Timer1 to generate an 8-bit Fast PWM signal on the GATE_PIN.
 * No prescaling is used to achieve the highest possible frequency for the buck converter.
 */
void setupPWM();

/**
 * @brief Sets the PWM duty cycle.
 * 
 * @param d The desired duty cycle as a float between 0.0 and 1.0.
 *          The value is clamped between PWM_MIN_DUTY and PWM_MAX_DUTY.
 */
void setDuty(float d);

/**
 * @brief Gets the current duty cycle.
 * 
 * @return The current duty cycle as a float (0.0 to 1.0).
 */
float getDuty();

/**
 * @brief Gets the timestamp of the last PWM change.
 * 
 * @return The system time (millis) when the duty cycle was last updated.
 *         Used to ensure the sensor reading has settled after a change.
 */
unsigned long getLastPwmChange();
