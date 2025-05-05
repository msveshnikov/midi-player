import React, { useState, useEffect, useCallback, useRef } from "react";
import MidiPlayer from "midi-player-js";
import Soundfont from "soundfont-player";

// --- AudioContext Management ---
let audioContext = null;
const getAudioContext = () => {
    // Ensure this runs only in the browser
    if (typeof window === "undefined") {
        return null;
    }
    if (!audioContext) {
        console.log("Creating new AudioContext");
        // Use a shared context to avoid hitting browser limits
        window.reactMidiAudioContext =
            window.reactMidiAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        audioContext = window.reactMidiAudioContext;
    }
    return audioContext;
};

const resumeAudioContext = async () => {
    const ac = getAudioContext();
    if (!ac) {
        console.warn("AudioContext not available (SSR or browser issue?).");
        return null;
    }
    if (ac.state === "suspended") {
        console.log("Resuming AudioContext...");
        try {
            await ac.resume();
            console.log("AudioContext Resumed.");
        } catch (err) {
            console.error("Error resuming AudioContext:", err);
            // Potentially inform the user they need to interact
        }
    }
    return ac;
};

// --- GM Instrument Mapping ---
const getInstrumentName = (programNumber) => {
    // General MIDI instrument map (program number -> soundfont name)
    const gmInstruments = [
        /* 0-7: Piano */ "acoustic_grand_piano",
        "bright_acoustic_piano",
        "electric_grand_piano",
        "honkytonk_piano",
        "electric_piano_1",
        "electric_piano_2",
        "harpsichord",
        "clavinet",
        /* 8-15: Chromatic Percussion */ "celesta",
        "glockenspiel",
        "music_box",
        "vibraphone",
        "marimba",
        "xylophone",
        "tubular_bells",
        "dulcimer",
        /* 16-23: Organ */ "drawbar_organ",
        "percussive_organ",
        "rock_organ",
        "church_organ",
        "reed_organ",
        "accordion",
        "harmonica",
        "tango_accordion",
        /* 24-31: Guitar */ "acoustic_guitar_nylon",
        "acoustic_guitar_steel",
        "electric_guitar_jazz",
        "electric_guitar_clean",
        "electric_guitar_muted",
        "overdriven_guitar",
        "distortion_guitar",
        "guitar_harmonics",
        /* 32-39: Bass */ "acoustic_bass",
        "electric_bass_finger",
        "electric_bass_pick",
        "fretless_bass",
        "slap_bass_1",
        "slap_bass_2",
        "synth_bass_1",
        "synth_bass_2",
        /* 40-47: Strings */ "violin",
        "viola",
        "cello",
        "contrabass",
        "tremolo_strings",
        "pizzicato_strings",
        "orchestral_harp",
        "timpani",
        /* 48-55: Ensemble */ "string_ensemble_1",
        "string_ensemble_2",
        "synth_strings_1",
        "synth_strings_2",
        "choir_aahs",
        "voice_oohs",
        "synth_choir",
        "orchestra_hit",
        /* 56-63: Brass */ "trumpet",
        "trombone",
        "tuba",
        "muted_trumpet",
        "french_horn",
        "brass_section",
        "synth_brass_1",
        "synth_brass_2",
        /* 64-71: Reed */ "soprano_sax",
        "alto_sax",
        "tenor_sax",
        "baritone_sax",
        "oboe",
        "english_horn",
        "bassoon",
        "clarinet",
        /* 72-79: Pipe */ "piccolo",
        "flute",
        "recorder",
        "pan_flute",
        "blown_bottle",
        "shakuhachi",
        "whistle",
        "ocarina",
        /* 80-87: Synth Lead */ "lead_1_square",
        "lead_2_sawtooth",
        "lead_3_calliope",
        "lead_4_chiff",
        "lead_5_charang",
        "lead_6_voice",
        "lead_7_fifths",
        "lead_8_bass_lead",
        /* 88-95: Synth Pad */ "pad_1_new_age",
        "pad_2_warm",
        "pad_3_polysynth",
        "pad_4_choir",
        "pad_5_bowed",
        "pad_6_metallic",
        "pad_7_halo",
        "pad_8_sweep",
        /* 96-103: Synth Effects */ "fx_1_rain",
        "fx_2_soundtrack",
        "fx_3_crystal",
        "fx_4_atmosphere",
        "fx_5_brightness",
        "fx_6_goblins",
        "fx_7_echoes",
        "fx_8_sci_fi",
        /* 104-111: Ethnic */ "sitar",
        "banjo",
        "shamisen",
        "koto",
        "kalimba",
        "bagpipe",
        "fiddle",
        "shanai",
        /* 112-119: Percussive */ "tinkle_bell",
        "agogo",
        "steel_drums",
        "woodblock",
        "taiko_drum",
        "melodic_tom",
        "synth_drum",
        "reverse_cymbal",
        /* 120-127: Sound Effects */ "guitar_fret_noise",
        "breath_noise",
        "seashore",
        "bird_tweet",
        "telephone_ring",
        "helicopter",
        "applause",
        "gunshot",
    ];
    // Use programNumber as the index. Default to piano if out of bounds.
    return gmInstruments[programNumber] || "acoustic_grand_piano";
};

const MidiPlayerComponent = () => {
    // --- State Variables ---
    const [midiFile, setMidiFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const [player, setPlayer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Combined loading state
    const [error, setError] = useState("");
    const [isSoundfontTestLoading, setIsSoundfontTestLoading] = useState(false);

    // --- Refs ---
    // Use refs for mutable objects that don't trigger re-renders but need persistence
    const instrumentsRef = useRef({}); // Cache for loaded Soundfont instruments { instrumentName: Soundfont.Player }
    const channelInstrumentsRef = useRef({}); // Maps channel number to current instrument *name* { channel: string }
    const activeNotesRef = useRef({}); // Tracks currently playing notes for potential stopping { noteId: Soundfont.PlayerNode }
    const soundfontOutputRef = useRef(null); // Holds the soundfont interaction logic

    // --- Load Soundfont Instrument (Cached) ---
    const loadInstrument = useCallback(async (instrumentName) => {
        const ac = getAudioContext(); // Get current context
        if (!ac) throw new Error("AudioContext not available for loading instrument.");

        // Check cache first
        if (instrumentsRef.current[instrumentName]) {
            return instrumentsRef.current[instrumentName];
        }

        console.log(`Loading instrument: ${instrumentName}...`);
        try {
            // Ensure context is running before loading
            await resumeAudioContext();
            const instrument = await Soundfont.instrument(ac, instrumentName);
            instrumentsRef.current[instrumentName] = instrument; // Cache it
            console.log(`Instrument loaded: ${instrumentName}`);
            return instrument;
        } catch (err) {
            console.error(`Failed to load instrument "${instrumentName}". Falling back to piano.`, err);
            setError((prev) => prev + `\nFailed to load "${instrumentName}", using piano.`);
            // Fallback: Load and cache piano if not already loaded
            if (!instrumentsRef.current["acoustic_grand_piano"]) {
                try {
                    instrumentsRef.current["acoustic_grand_piano"] = await Soundfont.instrument(
                        ac,
                        "acoustic_grand_piano"
                    );
                } catch (pianoErr) {
                    console.error("CRITICAL: Failed to load fallback piano instrument!", pianoErr);
                    throw new Error("Failed to load both requested instrument and fallback piano."); // Critical failure
                }
            }
            // Cache the fallback reference under the original name too, so we don't retry loading it constantly
            instrumentsRef.current[instrumentName] = instrumentsRef.current["acoustic_grand_piano"];
            return instrumentsRef.current["acoustic_grand_piano"];
        }
    }, []); // Empty dependency array means this function is created once

    // --- Soundfont Interaction Logic ---
    // This function creates the object responsible for handling MIDI events via Soundfont
    const createSoundfontOutput = useCallback(() => {
        const ac = getAudioContext();
        if (!ac) {
            console.error("Cannot create SoundfontOutput: AudioContext not ready.");
            return null;
        }

        // Initialize channel instruments (default to piano)
        for (let i = 0; i < 16; i++) {
            channelInstrumentsRef.current[i] = getInstrumentName(0); // Default to Acoustic Grand Piano (program 0)
        }
        // Preload piano immediately
        loadInstrument(getInstrumentName(0)).catch((err) => {
            console.error("Failed initial piano preload:", err);
            setError("Failed to preload default piano sound.");
        });

        return {
            // Handles MIDI "Note on" event
            playNote: async (noteName, channel, velocity) => {
                // velocity = 0 is sometimes used for Note Off
                if (!velocity || velocity === 0) {
                    // Optional: Implement note stopping if needed, but Soundfont usually handles decay
                    // this.stopNote(noteName, channel);
                    return;
                }

                const instrumentName = channelInstrumentsRef.current[channel] || getInstrumentName(0);
                try {
                    const instrument = await loadInstrument(instrumentName);
                    if (!instrument) {
                        console.warn(`Instrument not loaded for note ${noteName} on channel ${channel}`);
                        return;
                    }
                    // Play the note and store the playing node if stopping is needed later
                    console.log(`Playing: ${noteName} (Ch: ${channel}, Inst: ${instrumentName}, Vel: ${velocity})`);
                    const gain = velocity / 127; // Basic velocity mapping
                    const playingNode = instrument.play(noteName, ac.currentTime, { gain: gain });
                    // Store active note if needed (e.g., for explicit stop)
                    // const noteId = `${channel}-${noteName}`;
                    // activeNotesRef.current[noteId] = playingNode;
                } catch (err) {
                    console.error(`Error playing note ${noteName} on channel ${channel} with ${instrumentName}:`, err);
                }
            },

            // Handles MIDI "Note off" event (Optional, Soundfont often handles decay)
            stopNote: (noteName, channel) => {
                // Implement if explicit stopping is required (e.g., for sustain pedal or long notes)
                const noteId = `${channel}-${noteName}`;
                if (activeNotesRef.current[noteId]) {
                    activeNotesRef.current[noteId].stop();
                    delete activeNotesRef.current[noteId];
                    console.log(`Stopped: ${noteName} (Ch: ${channel})`);
                }
            },

            // Handles MIDI "Program Change" event
            programChange: async (channel, program) => {
                // Channel 10 (index 9) is often drums, but GM mapping still applies
                const instrumentName = getInstrumentName(program);
                console.log(`Program Change: Channel ${channel} to Program ${program} (${instrumentName})`);
                channelInstrumentsRef.current[channel] = instrumentName;

                // Preload the instrument to reduce latency on first note
                try {
                    await loadInstrument(instrumentName);
                } catch (err) {
                    console.error(`Failed to preload instrument ${instrumentName} for channel ${channel}:`, err);
                    // Error already handled/logged within loadInstrument
                }
            },

            // Optional: Handle Pitch Bend, Modulation, etc.
            // pitchBend: (channel, bendValue) => { ... }
            // controlChange: (channel, controllerNumber, value) => { ... }
        };
    }, [loadInstrument]); // Depends on loadInstrument

    // --- MIDI Player Event Handler ---
    // This function is passed directly to the MidiPlayer instance
    const midiEventHandler = useCallback((event) => {
        console.log("MIDI Event:", event); // Log every event

        // Ensure soundfont output is ready
        if (!soundfontOutputRef.current) {
            console.warn("Soundfont output not ready, skipping MIDI event:", event.name);
            return;
        }

        // Route MIDI events to the soundfont output handler
        switch (event.name) {
            case "Note on":
                // Check for velocity 0, which is sometimes used as Note off
                if (event.velocity > 0) {
                    soundfontOutputRef.current.playNote(event.noteName, event.channel, event.velocity);
                } else {
                    // Treat velocity 0 as Note off if needed
                    // soundfontOutputRef.current.stopNote(event.noteName, event.channel);
                    console.log(
                        `Note On with zero velocity (treat as Note Off): ${event.noteName} Ch: ${event.channel}`
                    );
                }
                break;
            case "Note off":
                // Optional: Explicitly handle Note Off if soundfont doesn't decay nicely or sustain is used
                // soundfontOutputRef.current.stopNote(event.noteName, event.channel);
                break;
            case "Program Change":
                soundfontOutputRef.current.programChange(event.channel, event.value);
                break;
            case "End of File":
                console.log("MIDI Playback Finished.");
                setIsPlaying(false); // Update state when playback ends
                // Optional: Reset channel instruments or stop all notes
                // activeNotesRef.current = {};
                break;
            // Add cases for other events if needed (Pitch Bend, Control Change, etc.)
            case 'Pitch Bend':
                soundfontOutputRef.current.pitchBend(event.channel, event.value);
                break;
            case 'Controller Change': // or specific CC events
                soundfontOutputRef.current.controlChange(event.channel, event.controllerNumber, event.value);
                break;
            default:
                // Log other events for debugging
                // console.log(`Unhandled MIDI Event: ${event.name}`, event);
                break;
        }
    }, []); // This handler itself doesn't depend on changing state/props

    // --- Effect for Initializing/Resetting Player ---
    useEffect(() => {
        // Cleanup function: Stops player and resets state
        const cleanup = () => {
            if (player) {
                console.log("MIDI Player: Stopping and cleaning up instance.");
                player.stop();
            }
            setPlayer(null);
            setIsPlaying(false);
            // Reset instrument caches and mappings if desired on file change
            // instrumentsRef.current = {};
            // channelInstrumentsRef.current = {};
            // activeNotesRef.current = {};
            soundfontOutputRef.current = null; // Clear the soundfont handler reference
        };

        if (!midiFile) {
            cleanup(); // Clean up if file is removed
            setIsLoading(false);
            setFileName("");
            return; // Exit effect early
        }

        // --- Start Initialization ---
        setIsLoading(true);
        setError("");
        setFileName(midiFile.name);
        cleanup(); // Clean up previous instance before loading new one

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                console.log("MIDI Player: FileReader onload - initializing...");

                // 1. Ensure AudioContext is running
                const ac = await resumeAudioContext();
                if (!ac) {
                    throw new Error("AudioContext could not be initialized or resumed.");
                }
                console.log(`MIDI Player: AudioContext state before player init: ${ac.state}`);

                // 2. Create the Soundfont Output handler
                // This needs to happen *before* creating the player
                soundfontOutputRef.current = createSoundfontOutput();
                if (!soundfontOutputRef.current) {
                    throw new Error("Failed to create Soundfont output handler.");
                }

                // 3. Create the MidiPlayer instance, passing our event handler
                console.log("MIDI Player: Creating MidiPlayer.Player instance...");
                const newPlayer = new MidiPlayer.Player(midiEventHandler);

                console.log("MIDI Player: Instance created. Loading ArrayBuffer...");
                newPlayer.loadArrayBuffer(e.target.result);
                console.log("MIDI Player: ArrayBuffer loaded.");

                // Wait a moment for player to potentially process initial events (like tempo)
                await new Promise((resolve) => setTimeout(resolve, 50));

                // Set player state *after* successful loading
                setPlayer(newPlayer);
                setIsPlaying(false); // Ready to play, but not playing yet
                setError("");
                console.log("MIDI Player: Initialization complete.");
            } catch (err) {
                console.error("MIDI Player: Error during initialization:", err);
                setError(`Error initializing player: ${err?.message || err}`);
                setPlayer(null); // Ensure player is null on error
                soundfontOutputRef.current = null;
            } finally {
                setIsLoading(false); // Loading finished (success or fail)
            }
        };

        reader.onerror = (e) => {
            console.error("MIDI Player: Error reading file:", e);
            setError("Error reading the MIDI file.");
            setIsLoading(false);
            setPlayer(null);
            setFileName("");
            soundfontOutputRef.current = null;
        };

        console.log("MIDI Player: Reading file as ArrayBuffer...");
        reader.readAsArrayBuffer(midiFile);

        // Return the cleanup function to be executed when the component unmounts
        // or when midiFile changes (triggering the effect again)
        return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [midiFile, midiEventHandler, createSoundfontOutput]); // Dependencies: effect runs if these change

    // --- File Input Handler ---
    const handleFileChange = async (event) => {
        // Always try to resume context on user interaction
        await resumeAudioContext();
        const file = event.target.files?.[0];
        if (file) {
            const validTypes = ["audio/midi", "audio/mid", "audio/x-midi"];
            const validExtensions = [".mid", ".midi"];
            const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

            // Basic validation
            if (validTypes.includes(file.type.toLowerCase()) || validExtensions.includes(fileExtension)) {
                setMidiFile(file); // Trigger the useEffect
                setError("");
            } else {
                setMidiFile(null);
                setFileName("");
                setError(`Invalid file type: "${file.type || fileExtension}". Please select a .mid or .midi file.`);
            }
        } else {
            // No file selected or selection cancelled
            setMidiFile(null);
            setFileName("");
        }
        // Reset the input value so selecting the same file again triggers onChange
        if (event.target) {
            event.target.value = null;
        }
    };

    // --- Playback Controls ---
    const handlePlay = async () => {
        // Ensure context is running before playing
        const ac = await resumeAudioContext();
        if (!ac) {
            setError("AudioContext not available. Cannot play.");
            return;
        }
        if (player && !isPlaying) {
            console.log("MIDI Player: Attempting player.play()...");
            try {
                player.play(); // Start playback
                setIsPlaying(true); // Update state
                setError("");
                console.log("MIDI Player: Play command sent.");
            } catch (err) {
                console.error("MIDI Player: Error during player.play():", err);
                setError(`Playback error: ${err?.message || err}`);
                setIsPlaying(false); // Ensure state is correct on error
            }
        } else if (!player) {
            console.warn("MIDI Player: Play ignored - Player not initialized.");
            setError("Please load a MIDI file first.");
        } else if (isPlaying) {
            console.warn("MIDI Player: Play ignored - Already playing.");
        }
    };

    const handlePause = () => {
        if (player && isPlaying) {
            player.pause();
            setIsPlaying(false);
            console.log("MIDI Player: Paused.");
            // Note: Soundfont might leave notes ringing depending on how it handles pause
            // You might need to stop active notes here if that's an issue
            // Object.values(activeNotesRef.current).forEach(node => node.stop());
            // activeNotesRef.current = {};
        }
    };

    const handleStop = () => {
        if (player) {
            player.stop(); // Stops player clock and resets playhead
            setIsPlaying(false);
            console.log("MIDI Player: Stopped.");
            // Stop any lingering notes explicitly
            Object.values(instrumentsRef.current).forEach((instrument) => {
                if (instrument && typeof instrument.stop === "function") {
                    // Soundfont doesn't have a global stop for all notes on an instrument easily.
                    // Stopping active notes individually is better if implemented.
                    // For simplicity now, we rely on the player stopping sending new notes.
                }
            });
            // activeNotesRef.current = {}; // Clear active notes
        }
    };

    // --- Direct Soundfont Test Function ---
    const handleTestSoundfont = async () => {
        setError("");
        setIsSoundfontTestLoading(true);
        console.log("[Soundfont Test] Starting...");
        try {
            const ac = await resumeAudioContext();
            if (!ac) {
                throw new Error("AudioContext could not be initialized for test.");
            }
            console.log(`[Soundfont Test] Using AudioContext state: ${ac.state}`);

            // Load piano using our cached loader
            const piano = await loadInstrument("acoustic_grand_piano");
            if (!piano) throw new Error("Failed to load piano for test.");

            console.log("[Soundfont Test] Playing test note (C4)...");
            piano.play("C4"); // Play C4 immediately

            // Optional: Play another note after a delay
            setTimeout(async () => {
                try {
                    const violin = await loadInstrument("violin");
                    if (violin) {
                        console.log("[Soundfont Test] Playing test note (G4 - Violin)...");
                        violin.play("G4");
                    } else {
                        console.warn("[Soundfont Test] Violin not loaded, skipping second note.");
                    }
                } catch (err) {
                    console.error("[Soundfont Test] Error loading/playing second note:", err);
                } finally {
                    setIsSoundfontTestLoading(false);
                    console.log("[Soundfont Test] Test complete.");
                }
            }, 800);
        } catch (err) {
            console.error("[Soundfont Test] Error:", err);
            setError(`Soundfont test error: ${err?.message || err}`);
            setIsSoundfontTestLoading(false);
        }
        // Don't set loading false immediately if using setTimeout
        // setIsSoundfontTestLoading(false); // Moved inside setTimeout's finally block
    };

    // --- Render Component ---
    return (
        <div style={styles.container}>
            <h2 style={styles.title}>React MIDI Player (Multi-Instrument)</h2>

            <button
                onClick={handleTestSoundfont}
                disabled={isLoading || isSoundfontTestLoading}
                style={{ ...styles.button, ...styles.testButton }}
            >
                {isSoundfontTestLoading ? "Testing Soundfont..." : "Test Soundfont (Piano C4, Violin G4)"}
            </button>

            <input
                type="file"
                accept=".mid,.midi,audio/midi,audio/mid,audio/x-midi"
                onChange={handleFileChange}
                disabled={isLoading || isSoundfontTestLoading} // Disable while loading MIDI or testing soundfont
                style={styles.input}
            />

            {fileName && <p style={styles.fileName}>Loaded: {fileName}</p>}
            {isLoading && <p style={styles.loading}>Loading MIDI & Instruments...</p>}
            {error && <p style={styles.error}>Error: {error}</p>}

            <div style={styles.controls}>
                <button onClick={handlePlay} disabled={!player || isPlaying || isLoading} style={styles.button}>
                    Play
                </button>
                <button onClick={handlePause} disabled={!player || !isPlaying || isLoading} style={styles.button}>
                    Pause
                </button>
                <button onClick={handleStop} disabled={!player || isLoading} style={styles.button}>
                    Stop
                </button>
            </div>
        </div>
    );
};

// --- Styles (Enhanced slightly) ---
const styles = {
    container: {
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: "25px",
        border: "1px solid #d0d0d0",
        borderRadius: "8px",
        maxWidth: "550px",
        margin: "30px auto",
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
    },
    title: {
        textAlign: "center",
        color: "#333",
        marginBottom: "25px",
        fontSize: "1.5em",
        fontWeight: 600,
    },
    testButton: {
        marginBottom: "20px",
        display: "block",
        width: "100%",
        backgroundColor: "#e0f2f7", // Light cyan
        borderColor: "#b3e0ed",
        color: "#006064", // Darker cyan text
        fontWeight: "bold",
        transition: "background-color 0.2s ease",
        "&:hover:not(:disabled)": {
            backgroundColor: "#ccebf3",
        },
        "&:disabled": {
            backgroundColor: "#f0f0f0",
            color: "#aaa",
            cursor: "not-allowed",
        },
    },
    input: {
        display: "block",
        marginBottom: "20px",
        width: "100%",
        padding: "8px",
        boxSizing: "border-box", // Include padding in width
        border: "1px solid #ccc",
        borderRadius: "4px",
    },
    fileName: {
        fontStyle: "italic",
        color: "#555",
        marginBottom: "15px",
        wordBreak: "break-all",
        fontSize: "0.9em",
        backgroundColor: "#f8f8f8",
        padding: "5px 8px",
        borderRadius: "3px",
    },
    loading: { color: "#ff9800", fontWeight: "bold", textAlign: "center", margin: "15px 0" }, // Orange
    error: {
        color: "#d32f2f", // Material Design red
        fontWeight: "bold",
        marginTop: "15px",
        padding: "10px",
        border: "1px solid #fbc0c0",
        borderRadius: "4px",
        backgroundColor: "#ffebee", // Light red background
        wordBreak: "break-word",
        whiteSpace: "pre-wrap", // Preserve line breaks in error messages
    },
    controls: {
        marginTop: "25px",
        display: "flex",
        gap: "15px", // Increased gap
        justifyContent: "center",
    },
    button: {
        padding: "10px 18px", // Slightly larger buttons
        fontSize: "1em",
        cursor: "pointer",
        borderRadius: "4px",
        border: "1px solid #ccc",
        backgroundColor: "#f0f0f0", // Lighter grey
        transition: "background-color 0.2s ease, border-color 0.2s ease",
        "&:hover:not(:disabled)": {
            backgroundColor: "#e0e0e0",
            borderColor: "#bbb",
        },
        "&:disabled": {
            backgroundColor: "#e0e0e0",
            color: "#aaa",
            cursor: "not-allowed",
            borderColor: "#d0d0d0",
        },
    },
};

export default MidiPlayerComponent;
