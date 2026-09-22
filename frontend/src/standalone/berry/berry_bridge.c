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

    int result = be_loadbuffer(student_vm, "student.be", source, strlen(source));
    if (result != BE_OK) return fail_with_stack_message(result);
    result = be_pcall(student_vm, 0);
    if (result != BE_OK) return fail_with_stack_message(result);
    clear_stack();

    if (!be_getglobal(student_vm, "mppt") || !be_isfunction(student_vm, -1)) {
        snprintf(last_error, sizeof(last_error), "Define a function named mppt(v, i, p, duty)");
        clear_stack();
        return BE_EXCEPTION;
    }
    clear_stack();
    return BE_OK;
}

EMSCRIPTEN_KEEPALIVE
double berry_step(double voltage, double current, double power, double duty) {
    last_error[0] = '\0';
    if (student_vm == NULL || !be_getglobal(student_vm, "mppt") || !be_isfunction(student_vm, -1)) {
        snprintf(last_error, sizeof(last_error), "No compiled mppt function");
        clear_stack();
        return NAN;
    }
    be_pushreal(student_vm, voltage);
    be_pushreal(student_vm, current);
    be_pushreal(student_vm, power);
    be_pushreal(student_vm, duty);
    int result = be_pcall(student_vm, 4);
    if (result != BE_OK) {
        fail_with_stack_message(result);
        return NAN;
    }
    if (!be_isnumber(student_vm, -1)) {
        snprintf(last_error, sizeof(last_error), "mppt must return a numeric duty cycle");
        clear_stack();
        return NAN;
    }
    double next_duty = be_toreal(student_vm, -1);
    clear_stack();
    return next_duty;
}

EMSCRIPTEN_KEEPALIVE
const char *berry_last_error(void) {
    return last_error;
}
