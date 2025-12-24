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
#define INA_ADDR        0x40  /** @brief I2C address of the INA226 current/voltage sensor. */
#define SHUNT_OHMS      0.1f  /** @brief Value of the current shunt resistor in Ohms. */
#define INA_MAX_CURRENT 0.8f  /** @brief Maximum expected current in Amps (used for INA226 calibration). */

#if defined(ARDUINO_ARDUINO_NANO_ESP32)
    // Arduino Nano ESP32 (S3) - Drop-in replacement for Nano
    // Uses the Arduino Pin Definitions to map to the correct physical location
    #define GATE_PIN        D9
    #define BTN_PIN         D3
    #define POT_PIN         A0
    
    // WiFi Settings
    #define WIFI_SSID       "EduGrid_MPPT"
    #define WEB_PORT        80

#elif defined(ESP32)
    #define GATE_PIN        18 /** @brief Pin number for the Buck converter MOSFET gate. */
    
    // ================= WIFI SETTINGS (ESP32 ONLY) =================
    #define WIFI_SSID       "EduGrid_MPPT"
    // #define WIFI_PASS       "12345678" // Open Network
    #define WEB_PORT        80
#else
    #define GATE_PIN        9 /** @brief Pin number for the Buck converter MOSFET gate (OC1A on Uno/Nano). */
#endif

// ================= PWM SETTINGS =================
#define PWM_MIN_DUTY    0.10f    /** @brief Minimum allowed PWM duty cycle (0.0 to 1.0). */ // 10 %
#define PWM_MAX_DUTY    0.90f    /** @brief Maximum allowed PWM duty cycle (0.0 to 1.0). */ // 90 %

// ================= MPPT ALGORITHM SETTINGS =================
#define ALGO_INCCOND    0 /** @brief Identifier for the Incremental Conductance algorithm. */
#define ALGO_PNO        1 /** @brief Identifier for the Perturb & Observe algorithm. */
#define DEFAULT_MPPT_ALGORITHM  ALGO_INCCOND /** @brief Default MPPT Algorithm. */

#define MPPT_PERIOD_MS  100      /** @brief Time interval between MPPT updates in milliseconds. */ // 10 Hz MPPT loop
#define DUTY_STEP_MIN   0.002f   /** @brief Minimum step size for duty cycle adjustment. */
#define DUTY_STEP_MAX   0.02f    /** @brief Maximum step size for duty cycle adjustment. */
#define DUTY_STEP_START 0.01f    /** @brief Default step size for duty cycle adjustment. */
#define SOFTSTART_MS    1000     /** @brief Duration of the soft-start phase in milliseconds. */
#define ALPHA           0.2f     /** @brief Low-pass filter coefficient (0.0 to 1.0). Higher = less smoothing. */
#define VIN_VALID_MIN   0.5f     /** @brief Minimum valid input voltage to start MPPT. */
#define IIN_VALID_MIN   0.0f     /** @brief Minimum valid input current. */
#define INA_SETTLE_MS   5        /** @brief Wait time after PWM change before measuring (INA conversion time). */
#define FIRST_KICK_STEP 0.05f    /** @brief Initial duty cycle disturbance when entering Auto mode. */

// ================= MANUAL CONTROL SETTINGS =================
#if defined(ARDUINO_ARDUINO_NANO_ESP32)
    #define BTN_PIN         D3
    #define POT_PIN         A7
#elif defined(ESP32)
    #define BTN_PIN         4  /** @brief Pin number for the mode toggle button. */
    #define POT_PIN         34 /** @brief Pin number for the potentiometer (Manual duty control). */
#else
    #define BTN_PIN         3  /** @brief Pin number for the mode toggle button (connected to GND). */
    #define POT_PIN         A7
#endif

/** @brief Debounce time for the button in milliseconds. */
#define BTN_DEBOUNCE_MS 30

/** @brief Update interval for the OLED display in milliseconds. */
#define DISPLAY_PERIOD_MS 50

// ================= POTENTIOMETER SETTINGS =================

/** @brief Number of ADC samples to average for each reading. */
#define POT_OVERSAMPLES   4

/** @brief IIR filter coefficient for potentiometer smoothing (0.0 to 1.0). */
#define POT_IIR_ALPHA     0.2f

/** @brief Enable auto-scaling for potentiometer input (1=Enabled, 0=Disabled). */
#define POT_AUTOCAL       0

// ================= DISPLAY SETTINGS =================

/** @brief I2C address of the SH1106 OLED display. */
#define OLED_ADDR   0x3C

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