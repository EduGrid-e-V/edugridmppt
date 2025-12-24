/**
 * @file display_manager.cpp
 * @brief Implementation of display management functions.
 */

#include "display_manager.h"
#include "config.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>

static Adafruit_SH1106G display(OLED_W, OLED_H, &Wire, -1); /** @brief Instance of the SH1106 display driver. */

void setupDisplay() {
  // Initialize the display with I2C address 0x3C
  if (!display.begin(OLED_ADDR, true)) { // true = I2C reset
    // Serial.println(F("SH1106 init failed")); 
  } else {
    displaySplash();
    delay(800); // Show splash screen for 800ms
  }
}

void displaySplash() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 0);
  
  // Display the selected MPPT algorithm
  #if MPPT_ALGORITHM == ALGO_PNO
    display.println(F("MPPT Buck (P&O)"));
  #else
    display.println(F("MPPT Buck (IncCond)"));
  #endif
  
  display.println(F("INA226 @0x40"));
  display.println(F("PWM D9 ~31kHz"));
  display.print  (F("Shunt: "));
  display.println(SHUNT_OHMS, 4);
  display.display();
}

void displayTelemetry(float pin, float vin, float iin, float duty, Mode mode, Algorithm algo) {
  display.clearDisplay();
 
  // Display Power (Large Font)
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.print(F("P "));
  display.print(pin, 3);
  display.println(F("W"));
 
  // Display Voltage
  display.setTextSize(1);
  display.setCursor(0, 21);
  display.print(F("Vin: "));
  display.print(vin, 2);
  display.println(F(" V"));
 
  // Display Current
  display.setCursor(0, 33);
  display.print(F("Iin: "));
  display.print(iin, 3);
  display.println(F(" A"));
 
  // Display Duty Cycle as whole percent
  int duty_pct = (int)lroundf(duty * 100.0f);
  display.setCursor(0, 45);
  display.print(F("Duty: "));
  display.print(duty_pct);
  display.println(F("%"));
 
  // Display Mode and Algorithm
  display.setCursor(0, 57);
  if (mode == MODE_AUTO) {
      display.print((algo == ALGORITHM_PNO) ? F("P&O") : F("IncCond"));
  } else {
      display.print(F("MANUAL"));
  }
 
  display.display();
}
