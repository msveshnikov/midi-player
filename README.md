# MIDI Player Component for React

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [Features](#features)
3.  [Technology Stack](#technology-stack)
4.  [Project Structure](#project-structure)
5.  [Architecture](#architecture)
    -   [Key Components](#key-components)
    -   [Module Interactions & Data Flow](#module-interactions--data-flow)
6.  [Installation](#installation)
7.  [Development](#development)
    -   [Running the Development Server](#running-the-development-server)
    -   [Building for Production](#building-for-production)
    -   [Linting](#linting)
    -   [Previewing the Production Build](#previewing-the-production-build)
8.  [Usage Instructions](#usage-instructions)
    -   [Importing the Component](#importing-the-component)
    -   [Basic Usage Example](#basic-usage-example)
    -   [Props API (MidiPlayerComponent.jsx)](#props-api-midiplayercomponentjsx)
9.  [Dependencies](#dependencies)
    -   [Runtime Dependencies](#runtime-dependencies)
    -   [Development Dependencies](#development-dependencies)
10. [Contributing](#contributing)
11. [License](#license)

## 1. Project Overview

This project, "test35" (likely a placeholder name for "MIDI Player Component for React"), aims to provide a reusable React component for embedding MIDI playback functionality into web applications. It leverages the `midi-player-js` library for core MIDI processing and playback, and `soundfont-player` for rendering MIDI notes with instrument sounds. The component is designed to be easily integrated into any React project built with Vite.

The primary goal is to offer a simple way for developers to add MIDI playback capabilities, potentially with controls like play, pause, stop, and a progress indicator, without needing to delve into the complexities of Web MIDI API or MIDI file parsing directly.

## 2. Features

-   **MIDI Playback:** Core functionality to play MIDI files.
-   **React Integration:** Encapsulated as a React component for easy use in React applications.
-   **SoundFont Support:** Utilizes SoundFonts via `soundfont-player` for rich instrument sounds (default or custom).
-   **Event-Driven:** (Anticipated) Exposes events for playback states (e.g., play, pause, stop, end, note events).
-   **Customizable:** (Anticipated) Props to control source MIDI, autoplay, soundfont, and potentially UI elements.

## 3. Technology Stack

-   **React 19:** For building the user interface component.
-   **Vite:** As the build tool and development server, offering fast HMR and optimized builds.
-   **midi-player-js:** The core JavaScript library for parsing and playing MIDI files.
-   **soundfont-player:** Used by `midi-player-js` or directly to load and play notes using SoundFont instrument samples.
-   **ESLint:** For code linting and maintaining code quality.
-   **HTML5, CSS3, JavaScript (ESM):** Standard web technologies.

## 4. Project Structure

The project follows a typical Vite + React setup:

# TODO

-   make it look nicer
