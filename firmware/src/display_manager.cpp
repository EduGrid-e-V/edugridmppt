/**
 * @file display_manager.cpp
 * @brief Implementation of display management functions.
 */

#include "display_manager.h"
#include "config.h"
#include <Wire.h>
#include <Adafruit_GFX.h>

#if OLED_CONTROLLER == OLED_CONTROLLER_SSD1306
#include <Adafruit_SSD1306.h>
#define OLED_TEXT_COLOR SSD1306_WHITE
static Adafruit_SSD1306 display(OLED_W, OLED_H, &Wire, -1);
#elif OLED_CONTROLLER == OLED_CONTROLLER_SH1106
#include <Adafruit_SH110X.h>
#define OLED_TEXT_COLOR SH110X_WHITE
static Adafruit_SH1106G display(OLED_W, OLED_H, &Wire, -1);
#else
#error "Unsupported OLED_CONTROLLER. Use OLED_CONTROLLER_SSD1306 or OLED_CONTROLLER_SH1106."
#endif

static bool displayIsReady = false;
static uint8_t activeOledAddress = OLED_ADDR;

static bool beginDisplayAtAddress(uint8_t address);

void setupDisplay() {
  displayIsReady = beginDisplayAtAddress(OLED_ADDR);
  activeOledAddress = OLED_ADDR;

#if OLED_ADDR_ALT != OLED_ADDR
  if (!displayIsReady) {
    displayIsReady = beginDisplayAtAddress(OLED_ADDR_ALT);
    activeOledAddress = OLED_ADDR_ALT;
  }
#endif

  if (displayIsReady) {
    Serial.print(F("OLED init OK at 0x"));
    Serial.println(activeOledAddress, HEX);
    displaySplash();
    delay(800); // Show splash screen for 800ms
  } else {
    Serial.println(F("OLED init failed at 0x3C and 0x3D"));
  }
}

void displaySplash() {
  if (!displayIsReady) return;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(OLED_TEXT_COLOR);
  display.setCursor(0, 0);
  
  display.println(F("EduGrid MPPT"));
  display.println(F("Edit mppt_alg.cpp"));
  display.println(F("INA226 @0x40"));
  display.println(F("PWM active"));
  display.print  (F("Shunt: "));
  display.println(SHUNT_OHMS, 4);
  display.display();
}

void displayWiFiSsid(const char* ssid) {
  if (!displayIsReady) return;

  const char* shownSsid = (ssid != nullptr && ssid[0] != '\0')
      ? ssid
      : WIFI_SSID_PREFIX;

  display.clearDisplay();
  display.setTextColor(OLED_TEXT_COLOR);

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(F("WiFi AP"));
  display.println(F("SSID"));

  display.setTextSize(2);
  int16_t textX = 0;
  int16_t textY = 0;
  uint16_t textWidth = 0;
  uint16_t textHeight = 0;
  display.getTextBounds(shownSsid, 0, 0, &textX, &textY, &textWidth, &textHeight);

  int16_t ssidX = (OLED_W - (int16_t)textWidth) / 2;
  if (ssidX < 0) {
      ssidX = 0;
  }

  display.setCursor(ssidX, 30);
  display.print(shownSsid);
  display.display();
}

void displayTelemetry(float panelPowerWatts,
                      float panelVoltageVolts,
                      float panelCurrentAmps,
                      float loadPowerWatts,
                      float loadVoltageVolts,
                      float loadCurrentAmps,
                      bool LoadSensorAvailable,
                      float converterDutyCycle,
                      Mode operatingMode,
                      Algorithm selectedAlgorithm) {
  if (!displayIsReady) return;

  display.clearDisplay();
 
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(F("Panel "));
  display.print(panelPowerWatts, 3);
  display.println(F("W"));

  display.setCursor(0, 11);
  display.print(F("PV "));
  display.print(panelVoltageVolts, 2);
  display.print(F("V "));
  display.print(panelCurrentAmps * 1000.0f, 0);
  display.println(F(" mA"));

  display.setCursor(0, 24);
  if (LoadSensorAvailable) {
      display.print(F("Load  "));
      display.print(loadPowerWatts, 3);
      display.println(F("W"));

      display.setCursor(0, 35);
      display.print(F("OUT "));
      display.print(loadVoltageVolts, 2);
      display.print(F("V "));
      display.print(loadCurrentAmps * 1000.0f, 0);
      display.println(F(" mA"));
  } else {
      display.println(F("Load INA: not found"));
  }

  int dutyPercent = (int)lroundf(converterDutyCycle * 100.0f);
  display.setCursor(0, 48);
  display.print(F("Duty "));
  display.print(dutyPercent);
  display.println(F("%"));
 
  display.setCursor(0, 57);
  if (operatingMode == MODE_AUTO) {
      display.print((selectedAlgorithm == ALGORITHM_PNO) ? F("Student") : F("IncCond"));
  } else {
      display.print(F("MANUAL"));
  }
 
  display.display();
}

static bool beginDisplayAtAddress(uint8_t address) {
#if OLED_CONTROLLER == OLED_CONTROLLER_SSD1306
  return display.begin(SSD1306_SWITCHCAPVCC, address);
#elif OLED_CONTROLLER == OLED_CONTROLLER_SH1106
  return display.begin(address, true);
#endif
}
