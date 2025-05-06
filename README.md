# MIDI Player Component for React

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

# TODO

-   make it look nicer
-   fix playback - process all events and stop notes when needed (they are not stopped)
