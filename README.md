# Spectrum Chisel — Sculpting Sound and Time

## ✨ Concept: Visualizing and Abstracting Sound

This project generates abstract visualizations that accumulate over time from audio captured in real time. Its central aim is to capture "sound" — a fleeting phenomenon — in a visual, organic form, and to preserve it as a permanent record: an artwork.

-   🎧 **Visualizing the structure of sound**: Sound is decomposed into eight frequency bands (SubBass–High), and each band is assigned a distinct geometric, abstract drawing style, translating the hierarchical structure of sound into visual expression.
-   🌱 **Organic motion and accumulation**: Animations such as noise, fluctuation, and rotation respond to the intensity and change of the sound, accumulating on the screen as time passes.
-   🖼️ **Toward static works**: Drawings can be saved as SVG, with a design that anticipates applications such as printing and printmaking.

Through this approach, the project offers the experience of "seeing sound" rather than "hearing sound," enabling creative and analytical use by artists and researchers.

---

## 📘 Spectrum Chisel — Manual

### 🎯 Project Overview

This project is a creative-coding tool that generates abstract visual art from the spectral information of sound, built on the `p5.js` family of libraries. With **"Phase 1: Preparing the material and the 'chisel'"** complete, the basic foundation is now in place for inputting sound and adjusting a rich set of parameters to create "sculptures of sound and time."

### 🎹 Controls

#### 1. Sound Source Control

Use the controller at the top right of the screen to manage the sound source and playback.

| UI element | Function |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Mic input button** | Inputs audio from a microphone connected to your PC in real time. |
| **File playback button** | Opens a file-selection dialog so you can load and play any audio file (mp3, wav, etc.). |
| **Mic Boost** | A sensitivity-amplification slider dedicated to mic input. When the mic input level is low, raise this value to increase drawing sensitivity. |
| **File Volume** | A volume slider dedicated to audio-file playback. Adjusts the input level of the source to control drawing sensitivity. |
| **Play / Pause** | Toggles the start and pause of the visualization. |
| **Stop / Reset** | Stops playback and clears all drawing on the canvas. |

#### 2. Drawing Control Panel

Use the UI panel at the top left to fine-tune the appearance of the drawing.

-   **General settings (Controls, Frame Rate)**
    -   Save as SVG or PNG, show/hide the UI, and reset the canvas.
    -   The `Frame Rate` slider adjusts how many times per second the drawing is rendered. Lower values produce works in which time passes more slowly.
-   **Global layers (Spectrum Layers)**
    -   **Spectrum Ring**: Toggles the layer that draws the energy of all frequency bands as a ring. `Gain` and `Threshold` adjust its sensitivity independently.
    -   **Spectrum Diff**: A layer that expresses the volume difference from the previous frame as stippling. It captures attacks and passages with sharp change. Its sensitivity is adjustable as well.
-   **Per-band layers (SubBass, Low, Mid ...)**
    -   For each of the eight frequency bands, you can finely configure drawing on/off, color, drawing style (8 types), line width, opacity, and more.
    -   **`Gain` / `Threshold`**: The most important parameters for adjusting the sensitivity of each band. Raising Threshold (or lowering Gain) makes the band respond only to louder sounds.
    -   **`IntensityGain` / `AngleSpeed`**: Adjust the magnitude and speed of motion of the selected drawing style.

---

### ⌨️ Keyboard Shortcuts

-   **S key**: Saves the current canvas as an SVG file.
-   **P key**: Saves the current canvas as a PNG image.
-   **C key**: Toggles the visibility of all UI.
-   **E key**: Resets the drawing.

---

### Roadmap

Next, the project will move to **"Phase 2: Exploring the techniques of the 'chisel'"**, aiming to implement the following features:

-   Saving and loading an artist's own discovered UI parameter settings as a "technique" in a JSON file.
-   Automatically inscribing information such as creation time and frame count into the filename when saving a work as SVG.
