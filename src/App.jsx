// src/components/MidiPlayerComponent.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import MidiPlayer from "midi-player-js";
import Soundfont from "soundfont-player";

// --- AudioContext Management ---
let audioContext = null;
const getAudioContext = () => {
    if (!audioContext) {
        console.log("Creating new AudioContext");
        audioContext = window.reactMidiAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        window.reactMidiAudioContext = audioContext;
    }
    return audioContext;
};
const resumeAudioContext = async () => {
    const ac = getAudioContext();
    if (ac && ac.state === "suspended") {
        console.log("Resuming AudioContext...");
        try {
            await ac.resume();
            console.log("AudioContext Resumed.");
        } catch (err) {
            console.error("Error resuming AudioContext:", err);
        }
    }
    return ac;
};

const MidiPlayerComponent = () => {
    // --- State Variables ---
    const [midiFile, setMidiFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const [player, setPlayer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [isSoundfontTestLoading, setIsSoundfontTestLoading] = useState(false);

    // --- Refs for accessing instruments and state ---
    const stateRefs = useRef();
    stateRefs.current = { setIsPlaying, setError };
    const instrumentsRef = useRef({});

    // --- Load Soundfont instruments ---
    const loadInstrument = async (instrument = "acoustic_grand_piano", ac) => {
        try {
            if (!instrumentsRef.current[instrument]) {
                console.log(`Loading instrument: ${instrument}`);
                instrumentsRef.current[instrument] = await Soundfont.instrument(ac, instrument);
                console.log(`Instrument loaded: ${instrument}`);
            }
            return instrumentsRef.current[instrument];
        } catch (err) {
            console.error(`Error loading instrument ${instrument}:`, err);
            throw err;
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
                throw new Error("AudioContext could not be initialized.");
            }
            console.log(`[Soundfont Test] Using AudioContext state: ${ac.state}`);

            // Load the instrument directly
            const piano = await loadInstrument("acoustic_grand_piano", ac);

            console.log("[Soundfont Test] Playing test note (C4)...");
            piano.play("C4");

            setTimeout(() => {
                console.log("[Soundfont Test] Playing test note (G4)...");
                piano.play("G4");
            }, 800);

            setIsSoundfontTestLoading(false);
            console.log("[Soundfont Test] Test complete.");
        } catch (err) {
            console.error("[Soundfont Test] Error:", err);
            setError(`Soundfont test error: ${err?.message || err}`);
            setIsSoundfontTestLoading(false);
        }
    };

    // --- Custom MIDI Output Instrument ---
    const createSoundfontOutput = useCallback(async () => {
        try {
            const ac = await resumeAudioContext();
            if (!ac) throw new Error("AudioContext not available");

            // Create our soundfont output handler
            return {
                playNote: async (note, channel) => {
                    try {
                        // Default to piano for now, properly we'd map channel to instrument
                        const instrumentName = channel === 9 ? "percussion" : "acoustic_grand_piano";
                        const instrument = await loadInstrument(instrumentName, ac);

                        if (note && instrument) {
                            console.log(`Playing note: ${note} on channel: ${channel}`);
                            instrument.play(note);
                        }
                    } catch (err) {
                        console.error(`Error playing note ${note}:`, err);
                    }
                },
                stopNote: () => {
                    // Can be implemented if needed
                },
                chordOn: () => {
                    // Can be implemented if needed
                },
                chordOff: () => {
                    // Can be implemented if needed
                },
                send: (data) => {
                    // Handle program change and other MIDI messages if needed
                    console.log("MIDI data:", data);
                },
            };
        } catch (err) {
            console.error("Error creating soundfont output:", err);
            throw err;
        }
    }, []);

    // --- Event Handler for MidiPlayer ---
    const playerEventHandler = useCallback((event) => {
        switch (event.name) {
            case "End of File":
                console.log("MIDI Player: Playback finished.");
                stateRefs.current.setIsPlaying(false);
                break;
            case "Note on":
                console.log(
                    `MIDI Player: Note On - Tick: ${event.tick}, Note: ${event.noteName} (#${event.noteNumber}), Vel: ${event.velocity}, Ch: ${event.channel}`
                );
                if (event.velocity === 0) {
                    console.warn(`MIDI Player: Note On with ZERO velocity detected for ${event.noteName}`);
                }
                break;
            case "Note off":
                console.log(
                    `MIDI Player: Note Off - Tick: ${event.tick}, Note: ${event.noteName} (#${event.noteNumber}), Ch: ${event.channel}`
                );
                break;
            case "Program Change":
                console.log(
                    `MIDI Player: Program Change - Tick: ${event.tick}, Ch: ${event.channel}, Instrument: ${event.value}`
                );
                break;
            case "Set Tempo":
                console.log(`MIDI Player: Set Tempo - Tick: ${event.tick}, Value: ${event.data} bpm`);
                break;
            default:
                break;
        }
    }, []);

    // --- Effect for Initializing/Resetting Player ---
    useEffect(() => {
        const cleanup = () => {
            if (player) {
                console.log("MIDI Player: Stopping and cleaning up instance.");
                player.stop();
                setPlayer(null);
                setIsPlaying(false);
            }
        };

        if (!midiFile) {
            cleanup();
            setIsLoading(false);
            setFileName("");
            return;
        }

        setIsLoading(true);
        setError("");
        setFileName(midiFile.name);

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                console.log("MIDI Player: FileReader onload - initializing MidiPlayer...");
                // Ensure context is ready
                const ac = await resumeAudioContext();
                if (!ac) {
                    throw new Error("AudioContext not available for MIDI Player");
                }
                console.log(`MIDI Player: AudioContext state before player init: ${ac.state}`);

                // Create our soundfont output
                const soundfontOutput = await createSoundfontOutput();

                // Create player with our soundfont output
                const newPlayer = new MidiPlayer.Player(playerEventHandler);
                // Connect our output to the player
                newPlayer.setOutput(soundfontOutput);

                console.log("MIDI Player: Instance created with custom Soundfont output.");

                // Load the ArrayBuffer
                newPlayer.loadArrayBuffer(e.target.result);
                console.log("MIDI Player: ArrayBuffer loaded.");

                // Give it a moment to prepare
                await new Promise((resolve) => setTimeout(resolve, 100));

                setPlayer(newPlayer);
                setIsPlaying(false);
                setError("");
            } catch (err) {
                console.error("MIDI Player: Error initializing:", err);
                setError(`Error initializing player: ${err?.message || err}`);
                setPlayer(null);
            } finally {
                setIsLoading(false);
            }
        };

        reader.onerror = (e) => {
            console.error("MIDI Player: Error reading file:", e);
            setError("Error reading the MIDI file.");
            setIsLoading(false);
            setPlayer(null);
            setFileName("");
        };

        reader.readAsArrayBuffer(midiFile);

        return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [midiFile, playerEventHandler, createSoundfontOutput]);

    // --- File Input Handler ---
    const handleFileChange = async (event) => {
        await resumeAudioContext();
        const file = event.target.files?.[0];
        if (file) {
            const validTypes = ["audio/midi", "audio/mid", "audio/x-midi"];
            const validExtensions = [".mid", ".midi"];
            const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
            if (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) {
                setMidiFile(file);
                setError("");
            } else {
                setMidiFile(null);
                setFileName("");
                setError("Please select a valid MIDI file (.mid, .midi)");
            }
        } else {
            setMidiFile(null);
            setFileName("");
        }
        if (event.target) {
            event.target.value = null;
        }
    };

    // --- Playback Controls ---
    const handlePlay = async () => {
        await resumeAudioContext();
        if (player && !isPlaying) {
            console.log("MIDI Player: Attempting player.play()...");
            try {
                player.play();
                setIsPlaying(true);
                setError("");
                console.log("MIDI Player: play() called, should be playing.");
            } catch (err) {
                console.error("MIDI Player: Error during player.play():", err);
                setError(`Playback error: ${err?.message || err}`);
                setIsPlaying(false);
            }
        } else {
            console.log("MIDI Player: Play ignored:", !player ? "No player" : "Already playing");
        }
    };

    const handlePause = () => {
        if (player && isPlaying) {
            player.pause();
            setIsPlaying(false);
            console.log("MIDI Player: Paused.");
        }
    };

    const handleStop = () => {
        if (player) {
            player.stop();
            setIsPlaying(false);
            console.log("MIDI Player: Stopped.");
        }
    };

    // --- Render Component ---
    return (
        <div style={styles.container}>
            <h2 style={styles.title}>React MIDI Player</h2>

            <button
                onClick={handleTestSoundfont}
                disabled={isSoundfontTestLoading}
                style={{
                    ...styles.button,
                    marginBottom: "15px",
                    display: "block",
                    width: "100%",
                    backgroundColor: "#e0f7fa",
                }}
            >
                {isSoundfontTestLoading ? "Testing Soundfont..." : "Test Soundfont (Play C4)"}
            </button>

            <input
                type="file"
                accept=".mid,.midi,audio/midi,audio/mid,audio/x-midi"
                onChange={handleFileChange}
                disabled={isLoading || isSoundfontTestLoading}
                style={styles.input}
            />

            {fileName && <p style={styles.fileName}>Loaded: {fileName}</p>}
            {isLoading && <p style={styles.loading}>Loading MIDI & instruments...</p>}
            {error && <p style={styles.error}>Error: {error}</p>}

            <div style={styles.controls}>
                <button onClick={handlePlay} disabled={!player || isPlaying || isLoading} style={styles.button}>
                    Play MIDI
                </button>
                <button onClick={handlePause} disabled={!player || !isPlaying || isLoading} style={styles.button}>
                    Pause MIDI
                </button>
                <button onClick={handleStop} disabled={!player || isLoading} style={styles.button}>
                    Stop MIDI
                </button>
            </div>
        </div>
    );
};

// --- Styles ---
const styles = {
    container: {
        fontFamily: "sans-serif",
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        maxWidth: "500px",
        margin: "20px auto",
        backgroundColor: "#f9f9f9",
    },
    title: { textAlign: "center", color: "#333", marginBottom: "20px" },
    input: { display: "block", marginBottom: "15px", width: "calc(100% - 10px)" },
    fileName: { fontStyle: "italic", color: "#555", marginBottom: "10px", wordBreak: "break-all" },
    loading: { color: "orange", fontWeight: "bold" },
    error: { color: "red", fontWeight: "bold", marginTop: "10px", wordBreak: "break-word" },
    controls: { marginTop: "20px", display: "flex", gap: "10px", justifyContent: "center" },
    button: {
        padding: "8px 15px",
        fontSize: "1em",
        cursor: "pointer",
        borderRadius: "4px",
        border: "1px solid #ccc",
        backgroundColor: "#eee",
    },
};

export default MidiPlayerComponent;
