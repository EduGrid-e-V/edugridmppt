/**
 * @file pwm_manager.cpp
 * @brief Implementation of PWM control functions.
 */

#include "pwm_manager.h"
#include "config.h"

/** @brief Current duty cycle state (0.0 to 1.0). */
static float _duty = PWM_MIN_DUTY;

/** @brief Timestamp of the last duty cycle change. */
static unsigned long _last_pwm_change = 0;

void setupPWM() {
#ifdef ESP32
  // ESP32 PWM Setup using LEDC
  // Frequency: 62.5kHz, Resolution: 8-bit (0-255)
  ledcSetup(0, 62500, 8);
  ledcAttachPin(GATE_PIN, 0);
  ledcWrite(0, 0);
#else
  // AVR (Nano) PWM Setup
  pinMode(GATE_PIN, OUTPUT);
  
  // Clear Timer1 control registers
  TCCR1A = 0;
  TCCR1B = 0;
  
  // Configure Fast PWM 8-bit mode: WGM10=1, WGM12=1
  // This counts from 0 to 255 and then overflows.
  TCCR1A |= _BV(WGM10);
  TCCR1B |= _BV(WGM12);
  
  // Set Non-inverting mode on OC1A (D9):
  // Clear OC1A on Compare Match, set OC1A at BOTTOM (non-inverting mode).
  TCCR1A |= _BV(COM1A1);
  
  // Set Prescaler to 1 (No prescaling)
  // Frequency = F_CPU / (Prescaler * 256) = 16MHz / 256 = 62.5kHz (Wait, Fast PWM 8-bit is F_CPU/256?)
  // Actually for Fast PWM 8-bit: F = 16000000 / (1 * 256) = 62500 Hz?
  // Wait, standard Arduino PWM is Phase Correct 490Hz or 980Hz.
  // With WGM12=1 (CTC) and WGM10=1 (Fast PWM 8-bit), TOP is 0x00FF (255).
  // F = 16MHz / (1 * 256) = 62.5 kHz.
  // Note: Previous comments said ~31kHz. Let's check if Phase Correct was intended.
  // If WGM10=1, WGM11=0, WGM12=1, WGM13=0 -> Mode 5: Fast PWM 8-bit.
  // If we want 31kHz, we might need Phase Correct (F_CPU / (2 * 256 * N)) = 31.25kHz.
  // But the code sets WGM10 and WGM12.
  // WGM10=1, WGM12=1 -> Mode 5 (Fast PWM 8-bit).
  // Frequency is 62.5kHz.
  // If the user said ~31kHz, maybe they meant Phase Correct?
  // But I will document what the code DOES.
  TCCR1B |= _BV(CS10);
  
  OCR1A = 0; // Start with 0 duty
#endif
}

void setDuty(float d) {
  // Clamp duty cycle to safe limits
  if (d < PWM_MIN_DUTY) d = PWM_MIN_DUTY;
  if (d > PWM_MAX_DUTY) d = PWM_MAX_DUTY;
  
  _duty = d;
  
  // Convert float 0..1 to integer 0..255
  int pwm = (int)(_duty * 255.0f + 0.5f);
  
  // Safety clamp for integer conversion
  if (pwm < 0)   pwm = 0;
  if (pwm > 255) pwm = 255;
  
#ifdef ESP32
  ledcWrite(0, pwm);
#else
  OCR1A = pwm; // Write duty to OC1A (D9)
#endif
  _last_pwm_change = millis();
}

float getDuty() {
    return _duty;
}

unsigned long getLastPwmChange() {
    return _last_pwm_change;
}
