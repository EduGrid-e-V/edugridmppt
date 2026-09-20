/**
 * @file config.h
 * @brief Configuration constants and settings for the MPPT Buck Converter.
 *
 * This file contains all the user-configurable settings, pin definitions,
 * and system constants. It also defines the operating modes and algorithm selection.
 */

#pragma once

#include <stdint.h>
#include <Arduino.h>

// ================= HARDWARE SETTINGS =================
#define PANEL_INA_ADDR  0x40  /** @brief I2C address of the panel/input-side INA226 sensor. */
#define LOAD_INA_ADDR   0x41  /** @brief I2C address of the load/output-side INA226 sensor. */
#define INA_ADDR        PANEL_INA_ADDR /** @brief Backward-compatible name for the panel INA226 address. */
#define SHUNT_OHMS      0.1f  /** @brief Value of each current shunt resistor in Ohms. */
#define INA_MAX_CURRENT 0.2f  /** @brief Maximum expected current in Amps (used for INA226 calibration). */
#define INA_AVERAGE_MODE 2    /** @brief INA226 averaging: 0=1, 1=4, 2=16, 3=64, ... 7=1024 samples. */
#define INA_CONVERSION_TIME_MODE 4 /** @brief INA226 conversion time: 4=1100us for bus and shunt. */

#if defined(EDUGRID_ESP32_C3_SUPER_MINI)
    // ESP32-C3 Super Mini test board.
    // PlatformIO uses the compatible lolin_c3_mini board definition for USB CDC.
    // Reassign these pins for the next EduGrid PCB revision.
    #define GATE_PIN        3
    #define BTN_PIN         2
    #define POT_PIN         A0
    #define ENABLE_WIFI_DASHBOARD 1

    // WiFi Settings
    #define WIFI_SSID_PREFIX "EduGrid_"
    #define WEB_PORT         80
    #define CAPTIVE_DNS_PORT 53

#elif defined(ARDUINO_NANO_ESP32) || defined(ARDUINO_ARDUINO_NANO_ESP32)
    // Arduino Nano ESP32 (S3) - Drop-in replacement for Nano
    // Uses the Arduino Pin Definitions to map to the correct physical location
    #define GATE_PIN        D5
    #define BTN_PIN         D3
    #define POT_PIN         A7
    #define ENABLE_WIFI_DASHBOARD 1
    
    // WiFi Settings
    #define WIFI_SSID_PREFIX "EduGrid_"
    #define WEB_PORT         80
    #define CAPTIVE_DNS_PORT 53

#else
    #define GATE_PIN        9 /** @brief Pin number for the Buck converter MOSFET gate (OC1A on Uno/Nano). */
    #define BTN_PIN         3  /** @brief Pin number for the mode toggle button (connected to GND). */
    #define POT_PIN         A7 /** @brief Pin number for the potentiometer (manual duty control). */

#endif

#ifndef ENABLE_WIFI_DASHBOARD
#define ENABLE_WIFI_DASHBOARD 0
#endif

#ifndef WIFI_SSID_PREFIX
#define WIFI_SSID_PREFIX "EduGrid_"
#endif

#ifndef CAPTIVE_DNS_PORT
#define CAPTIVE_DNS_PORT 53
#endif

// ================= PWM SETTINGS =================
#define PWM_MIN_DUTY    0.0f    /** @brief Minimum allowed PWM duty cycle (0.0 to 1.0). */ // 10 %
#define PWM_MAX_DUTY    0.98f    /** @brief Maximum allowed PWM duty cycle (0.0 to 1.0). */ // 90 %

// ================= MPPT ALGORITHM SETTINGS =================
#define ALGO_INCCOND    0 /** @brief Identifier for the Incremental Conductance algorithm. */
#define ALGO_PNO        1 /** @brief Identifier for the Perturb & Observe algorithm. */
#define DEFAULT_MPPT_ALGORITHM  ALGO_INCCOND /** @brief Default MPPT Algorithm. */

#define MPPT_PERIOD_MS  100      /** @brief Time interval between MPPT updates in milliseconds. */ // 10 Hz MPPT loop
#define DUTY_STEP_MIN   0.002f   /** @brief Minimum step size for duty cycle adjustment. */
#define DUTY_STEP_MAX   0.02f    /** @brief Maximum step size for duty cycle adjustment. */
#define DUTY_STEP_START 0.01f    /** @brief Default step size for duty cycle adjustment. */
#define SOFTSTART_MS    1000     /** @brief Duration of the soft-start phase in milliseconds. */
#define SENSOR_IIR_ALPHA 0.2f    /** @brief Low-pass filter coefficient (0.0 to 1.0). Higher = less smoothing. */
/** @brief Enable the optional software IIR filter on sensor readings (1=on, 0=off). */
#define ENABLE_SENSOR_IIR_FILTER 0
#define COMPARE_MEASUREMENT_FILTERS 1 /** @brief Print raw-vs-filtered sensor data over Serial when enabled. */
#define FILTER_COMPARE_PERIOD_MS 1000 /** @brief Interval for raw-vs-filtered Serial comparison. */
#define VIN_VALID_MIN   0.5f     /** @brief Minimum valid input voltage to start MPPT. */
#define IIN_VALID_MIN   0.0f     /** @brief Minimum valid input current. */
#define INA_SETTLE_MS   5        /** @brief Wait time after PWM change before measuring (INA conversion time). */
#define FIRST_KICK_STEP 0.05f    /** @brief Initial duty cycle disturbance when entering Auto mode. */

/** @brief Debounce time for the button in milliseconds. */
#define BTN_DEBOUNCE_MS 30

/** @brief Update interval for the OLED display in milliseconds. */
#define DISPLAY_PERIOD_MS 50

/** @brief Time to show the WiFi SSID on the OLED after boot. */
#define WIFI_SSID_DISPLAY_MS 15000UL

// ================= POTENTIOMETER SETTINGS =================

/** @brief Number of ADC samples to average for each reading. */
#define POT_OVERSAMPLES   8

/** @brief Raw ADC value at the minimum potentiometer position. */
#define POT_ADC_MIN       0

/** @brief Raw ADC value at the maximum potentiometer position. */
#define POT_ADC_MAX       1023

/** @brief Print potentiometer raw/smoothed/duty values while manual control reads the knob. */
#define POT_DEBUG_SERIAL  0

/** @brief IIR filter coefficient for potentiometer smoothing (0.0 to 1.0). */
#define POT_IIR_ALPHA     0.65f

/** @brief Larger raw ADC jumps use this faster smoothing value. */
#define POT_FAST_IIR_ALPHA 0.90f

/** @brief Raw ADC jump that counts as intentional slider movement. */
#define POT_FAST_DELTA_RAW 24.0f

/** @brief Enable auto-scaling for potentiometer input (1=Enabled, 0=Disabled). */
#define POT_AUTOCAL       0

/** @brief Pot movement needed before the knob takes control back from the web slider. */
#define POT_TAKEOVER_THRESHOLD 0.03f

// ================= DISPLAY SETTINGS =================

/** @brief OLED controller type for common 128x64 I2C modules. */
#define OLED_CONTROLLER_SSD1306 1
#define OLED_CONTROLLER_SH1106  2

/** @brief Active OLED controller. Most 0.96 inch 128x64 I2C OLEDs use SSD1306. */
#define OLED_CONTROLLER OLED_CONTROLLER_SSD1306

/** @brief Primary I2C address of the OLED display. */
#define OLED_ADDR   0x3C

/** @brief Secondary I2C address used by some OLED modules. */
#define OLED_ADDR_ALT 0x3D

/** @brief Width of the OLED display in pixels. */
#define OLED_W      128

/** @brief Height of the OLED display in pixels. */
#define OLED_H      64

// ================= SYSTEM TYPES =================

/**
 * @brief Operating modes of the system.
 */
enum Mode : uint8_t { 
    MODE_AUTO = 0,  /**< Automatic MPPT mode */
    MODE_MANUAL = 1 /**< Manual duty cycle control via potentiometer */
};

/**
 * @brief Available MPPT Algorithms.
 */
enum Algorithm : uint8_t {
    ALGORITHM_INCCOND = ALGO_INCCOND,
    ALGORITHM_PNO = ALGO_PNO
};
