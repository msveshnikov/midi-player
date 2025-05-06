# `src/MidiPlayerComponent.jsx` Documentation

## Overview

This file defines a React functional component, `MidiPlayerComponent`, that provides a user interface for loading and playing MIDI files directly in the browser. It utilizes the Web Audio API via the `soundfont-player` library to synthesize audio using Soundfont instruments and the `midi-player-js` library to parse and process MIDI events. The component handles file selection, playback controls (play, pause, stop), loading states, error reporting, and basic multi-instrument support based on MIDI program change messages.

## File Location

`src/MidiPlayerComponent.jsx` is located within the `src` directory of the project, alongside other core application files like `App.jsx` and `main.jsx`. It is intended to be imported and used within a parent component, typically `App.jsx`, to render the MIDI player interface.
