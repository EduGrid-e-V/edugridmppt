/**
 * @file config.h
 * @brief Configuration constants and settings for the MPPT Buck Converter.
 *
 * This file contains all the user-configurable settings, pin definitions,
 * and system constants. It also defines the operating modes and algorithm selection.
 */

#pragma once

#include <stdint.h>

// ================= HARDWARE SETTINGS =================

/** @brief I2C address of the INA226 current/voltage sensor. */
#define INA_ADDR        0x40

/** @brief Value of the current shunt resistor in Ohms. */
#define SHUNT_OHMS      0.1f

/** @brief Maximum expected current in Amps (used for INA226 calibration). */
#define INA_MAX_CURRENT 0.8f

#ifdef ESP32
    /** @brief Pin number for the Buck converter MOSFET gate. */
    #define GATE_PIN        18
    
    // ================= WIFI SETTINGS (ESP32 ONLY) =================
    #define WIFI_SSID       "EduGrid_MPPT"
    // #define WIFI_PASS       "12345678" // Open Network
    #define WEB_PORT        80
#else
    /** @brief Pin number for the Buck converter MOSFET gate (OC1A on Uno/Nano). */
    #define GATE_PIN        9
#endif

// ================= PWM SETTINGS =================

/** @brief Minimum allowed PWM duty cycle (0.0 to 1.0). */
#define PWM_MIN_DUTY    0.10f    // 10 %

/** @brief Maximum allowed PWM duty cycle (0.0 to 1.0). */
#define PWM_MAX_DUTY    0.90f    // 90 %

// ================= MPPT ALGORITHM SETTINGS =================

/** @brief Identifier for the Incremental Conductance algorithm. */
#define ALGO_INCCOND    0

/** @brief Identifier for the Perturb & Observe algorithm. */
#define ALGO_PNO        1

/** 
 * @brief Default MPPT Algorithm.
 */
#define DEFAULT_MPPT_ALGORITHM  ALGO_INCCOND

/** @brief Time interval between MPPT updates in milliseconds. */
#define MPPT_PERIOD_MS  100      // 10 Hz MPPT loop

/** @brief Minimum step size for duty cycle adjustment. */
#define DUTY_STEP_MIN   0.002f

/** @brief Maximum step size for duty cycle adjustment. */
#define DUTY_STEP_MAX   0.02f

/** @brief Default step size for duty cycle adjustment. */
#define DUTY_STEP_START 0.01f

/** @brief Duration of the soft-start phase in milliseconds. */
#define SOFTSTART_MS    1000

/** @brief Low-pass filter coefficient (0.0 to 1.0). Higher = less smoothing. */
#define ALPHA           0.2f

/** @brief Minimum valid input voltage to start MPPT. */
#define VIN_VALID_MIN   0.5f

/** @brief Minimum valid input current. */
#define IIN_VALID_MIN   0.0f

/** @brief Wait time after PWM change before measuring (INA conversion time). */
#define INA_SETTLE_MS   5

/** @brief Initial duty cycle disturbance when entering Auto mode. */
#define FIRST_KICK_STEP 0.05f

// ================= MANUAL CONTROL SETTINGS =================

#ifdef ESP32
    /** @brief Pin number for the mode toggle button. */
    #define BTN_PIN         4
    
    /** @brief Pin number for the potentiometer (Manual duty control). */
    #define POT_PIN         34
#else
    /** @brief Pin number for the mode toggle button (connected to GND). */
    #define BTN_PIN         3
    
    /** @brief Pin number for the potentiometer (Manual duty control). */
    #define POT_PIN         A7
#endif

/** @brief Debounce time for the button in milliseconds. */
#define BTN_DEBOUNCE_MS 30

/** @brief Update interval for the OLED display in milliseconds. */
#define DISPLAY_PERIOD_MS 50

// ================= POTENTIOMETER SETTINGS =================

/** @brief Number of ADC samples to average for each reading. */
#define POT_OVERSAMPLES   8

/** @brief IIR filter coefficient for potentiometer smoothing (0.0 to 1.0). */
#define POT_IIR_ALPHA     0.2f

/** @brief Enable auto-scaling for potentiometer input (1=Enabled, 0=Disabled). */
#define POT_AUTOCAL       1

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