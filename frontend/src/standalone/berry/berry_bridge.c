/*
 * Browser bridge for the unmodified Berry 1.1.0 interpreter API.
 * Berry source: https://github.com/berry-lang/berry/tree/v1.1.0 (MIT).
 * This file is retained so the checked-in WASM can be reproduced.
 */
#include <emscripten/emscripten.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "berry.h"

static bvm *student_vm = NULL;
static char last_error[512] = "";
static double pv_voltage, pv_current, pv_power;
static double load_voltage, load_current, load_power;
static double student_duty;
static int load_available;

static int push_real(bvm *vm, double value) { be_pushreal(vm, value); return be_returnvalue(vm); }
static int native_pv_voltage(bvm *vm) { return push_real(vm, pv_voltage); }
static int native_pv_current(bvm *vm) { return push_real(vm, pv_current); }
static int native_pv_power(bvm *vm) { return push_real(vm, pv_power); }
static int native_load_voltage(bvm *vm) { return push_real(vm, load_voltage); }
static int native_load_current(bvm *vm) { return push_real(vm, load_current); }
static int native_load_power(bvm *vm) { return push_real(vm, load_power); }
static int native_load_available(bvm *vm) { be_pushbool(vm, load_available); return be_returnvalue(vm); }
static int native_duty_get(bvm *vm) { return push_real(vm, student_duty); }
static int native_duty_set(bvm *vm) { student_duty = be_toreal(vm, 1); return be_returnnilvalue(vm); }
static int native_duty_change(bvm *vm) { student_duty += be_toreal(vm, 1); return be_returnnilvalue(vm); }

static const char *student_api =
    "class MeasurementPort\n"
    "  var load_side\n"
    "  def init(load_side) self.load_side = load_side end\n"
    "  def getVoltage() if self.load_side return _load_voltage() end return _pv_voltage() end\n"
    "  def getCurrent() if self.load_side return _load_current() end return _pv_current() end\n"
    "  def getPower() if self.load_side return _load_power() end return _pv_power() end\n"
    "  def isAvailable() if self.load_side return _load_available() end return true end\n"
    "end\n"
    "class DutyControl\n"
    "  def get() return _duty_get() end\n"
    "  def set(value) _duty_set(value) end\n"
    "  def change(delta) _duty_change(delta) end\n"
    "end\n"
    "PV = MeasurementPort(false)\n"
    "load = MeasurementPort(true)\n"
    "duty = DutyControl()\n";

static void clear_stack(void) {
    if (student_vm != NULL) {
        int top = be_top(student_vm);
        if (top > 0) be_pop(student_vm, top);
    }
}

static int fail_with_stack_message(int code) {
    const char *message = student_vm != NULL && be_top(student_vm) > 0
        ? be_tostring(student_vm, -1)
        : NULL;
    snprintf(last_error, sizeof(last_error), "%s", message == NULL ? "Berry interpreter error" : message);
    clear_stack();
    return code == 0 ? BE_EXCEPTION : code;
}

EMSCRIPTEN_KEEPALIVE
int berry_compile(const char *source) {
    if (student_vm != NULL) be_vm_delete(student_vm);
    student_vm = be_vm_new();
    last_error[0] = '\0';
    if (student_vm == NULL) {
        snprintf(last_error, sizeof(last_error), "Unable to allocate Berry VM");
        return BE_MALLOC_FAIL;
    }

    be_regfunc(student_vm, "_pv_voltage", native_pv_voltage);
    be_regfunc(student_vm, "_pv_current", native_pv_current);
    be_regfunc(student_vm, "_pv_power", native_pv_power);
    be_regfunc(student_vm, "_load_voltage", native_load_voltage);
    be_regfunc(student_vm, "_load_current", native_load_current);
    be_regfunc(student_vm, "_load_power", native_load_power);
    be_regfunc(student_vm, "_load_available", native_load_available);
    be_regfunc(student_vm, "_duty_get", native_duty_get);
    be_regfunc(student_vm, "_duty_set", native_duty_set);
    be_regfunc(student_vm, "_duty_change", native_duty_change);

    int result = be_loadbuffer(student_vm, "student-api.be", student_api, strlen(student_api));
    if (result != BE_OK) return fail_with_stack_message(result);
    result = be_pcall(student_vm, 0);
    if (result != BE_OK) return fail_with_stack_message(result);
    clear_stack();

    result = be_loadbuffer(student_vm, "student.be", source, strlen(source));
    if (result != BE_OK) return fail_with_stack_message(result);
    result = be_pcall(student_vm, 0);
    if (result != BE_OK) return fail_with_stack_message(result);
    clear_stack();

    if (!be_getglobal(student_vm, "mppt") || !be_isfunction(student_vm, -1)) {
        snprintf(last_error, sizeof(last_error), "Define a function named mppt()");
        clear_stack();
        return BE_EXCEPTION;
    }
    clear_stack();
    return BE_OK;
}

EMSCRIPTEN_KEEPALIVE
double berry_step(double panel_v, double panel_i, double panel_p,
                  double output_v, double output_i, double output_p,
                  double duty_value, int output_available) {
    last_error[0] = '\0';
    pv_voltage = panel_v;
    pv_current = panel_i;
    pv_power = panel_p;
    load_voltage = output_v;
    load_current = output_i;
    load_power = output_p;
    student_duty = duty_value;
    load_available = output_available;
    if (student_vm == NULL || !be_getglobal(student_vm, "mppt") || !be_isfunction(student_vm, -1)) {
        snprintf(last_error, sizeof(last_error), "No compiled mppt function");
        clear_stack();
        return NAN;
    }
    int result = be_pcall(student_vm, 0);
    if (result != BE_OK) {
        fail_with_stack_message(result);
        return NAN;
    }
    clear_stack();
    return student_duty;
}

EMSCRIPTEN_KEEPALIVE
const char *berry_last_error(void) {
    return last_error;
}
