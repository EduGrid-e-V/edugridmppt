# EduGrid PV Learning Site

The learning site is a static Vue application for guided photovoltaic and MPPT lessons. It is designed to work from a normal web host, a local file bundle, or the ESP32 captive portal.

## Run locally

```bash
cd learn
npm install
npm run dev
```

Run the complete local quality check with:

```bash
npm run check
```

## Add content

Module content will live in `content/de/` and `content/en/`. Schemas and the full validator are introduced in workplan task T-4.1. After that task, run `npm run validate` whenever content changes.

## Build

Create the standard offline web build with:

```bash
npm run build
```

The ESP32-specific subset and its `build:esp` command are introduced in workplan task T-7.4. Until then, do not copy the regular web build into `firmware/data/`.
