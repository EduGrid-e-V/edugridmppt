<p align="center">
  <img src="docs/assets/edugrid_logo.svg" width="320" alt="EduGrid logo">
</p>

<h1 align="center">EduGrid MPPT</h1>

<p align="center">
  <strong>Learn solar energy by trying it.</strong><br>
  A friendly, open-source learning kit for renewable energy education.
</p>

<p align="center">
  <img src="docs/assets/icon-sun.svg" width="56" alt="Sun icon">
  &nbsp;&nbsp;
  <img src="docs/assets/icon-book.svg" width="56" alt="Learning icon">
</p>

EduGrid MPPT is part of the EduGrid e.V initiative for free education in renewable energies. It is made for students, teachers, workshops, and curious people who want to understand solar power with their own hands.

You do not need to be an expert to begin. Start by turning a knob, watching the display, and seeing how much power a small solar panel can produce. Later, when you feel ready, you can open the code and teach the board your own strategy for finding more power.

![EduGrid MPPT board](firmware/docs/arduino_mppt.png)

## What You Can Discover

- How sunlight becomes electrical power.
- Why a solar panel has a "best point" where it gives the most energy.
- How a small controller can search for that point automatically.
- How coding, electronics, and renewable energy connect in one real project.

This is not just a board and some code. It is a small learning environment: measure something real, ask why it happens, change one thing, and try again.

## Choose Your Path

| I want to... | Start here |
| --- | --- |
| learn the project step by step | [Student Workbook](docs/STUDENT_WORKBOOK.md) |
| upload the firmware to the board | [Firmware Instructions](firmware/README.md) |
| look at the circuit and PCB | [Hardware Files](hardware/README.md) |
| explore the web dashboard | [Dashboard Source](frontend/README.md) |

## For Students

Begin with the workbook and the manual experiments. Your first goal is simple: find the duty setting where the solar panel produces the most power.

When you are ready to code, your workspace is:

```text
firmware/src/mppt_alg.cpp
```

Small changes are welcome. Good experiments often begin with "What happens if I try this?"

## For Teachers

EduGrid MPPT is designed for gentle entry and deeper follow-up. A first lesson can stay fully practical: connect the board, change the operating point, and discuss power. Later lessons can introduce algorithms, sensor data, dashboards, and the structure of embedded software.

The [Student Workbook](docs/STUDENT_WORKBOOK.md) is written so it can be used in class or exported as a PDF for home study.

## The Bigger Picture

EduGrid e.V works to make renewable energy education freely available. This project supports that mission with open learning material, open hardware files, and firmware that students can actually read and change.

Renewable energy becomes less mysterious when learners can touch it, measure it, and improve it. That is the spirit of EduGrid MPPT.

