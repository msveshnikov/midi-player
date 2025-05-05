// src/components/MidiPlayerComponent.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import MidiPlayer from "midi-player-js";
import Soundfont from "soundfont-player"; // ***** IMPORT THIS *****

// --- AudioContext Management (Keep as before) ---
let audioContext = null;
const getAudioContext = () => {
    if (!audioContext) {
        console.log("Creating new AudioContext");
        // Check for existence first (useful for React StrictMode double-invokes)
        audioContext = window.reactMidiAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        window.reactMidiAudioContext = audioContext; // Store globally if needed
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
    return ac; // Return the context
};

const MidiPlayerComponent = () => {
    // --- State Variables (Add one for the test button) ---
    const [midiFile, setMidiFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const [player, setPlayer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [isSoundfontTestLoading, setIsSoundfontTestLoading] = useState(false); // State for test button

    // Ref for state setters (Keep as before)
    const stateRefs = useRef();
    stateRefs.current = { setIsPlaying, setError };

    // --- Direct Soundfont Test Function ---
    const handleTestSoundfont = async () => {
        setError("");
        setIsSoundfontTestLoading(true);
        console.log("[Soundfont Test] Starting...");
        try {
            const ac = await resumeAudioContext(); // Ensure context is ready and resumed
            if (!ac) {
                throw new Error("AudioContext could not be initialized.");
            }
            console.log(`[Soundfont Test] Using AudioContext state: ${ac.state}`);

            // Load the instrument directly using soundfont-player
            // Using 'acoustic_grand_piano' as it's common and likely downloaded
            const piano = await Soundfont.instrument(ac, "acoustic_grand_piano", {
                // soundfont: 'FluidR3_GM' // Optional: Try forcing a different soundfont if default fails
                // gain: 1 // Optional: adjust volume
            });

            console.log("[Soundfont Test] Instrument loaded.");

            // Play a single note (e.g., C4 - Middle C)
            console.log("[Soundfont Test] Playing test note (C4)...");
            piano.play("C4"); // Returns an ActiveAudioNode object, can be stopped etc.

            // Optionally schedule another note slightly later
            // setTimeout(() => {
            //     console.log('[Soundfont Test] Playing test note (G4)...');
            //     piano.play('G4');
            // }, 800);

            // Note: Sound will play immediately. No need to set loading false instantly unless
            // you want the button re-enabled right away.
            setIsSoundfontTestLoading(false); // Re-enable button
            console.log("[Soundfont Test] Test complete.");
        } catch (err) {
            console.error("[Soundfont Test] Error:", err);
            setError(`Soundfont test error: ${err?.message || err}`);
            setIsSoundfontTestLoading(false);
        }
    };

    // --- Event Handler for MidiPlayer (Add detailed logging) ---
    const playerEventHandler = useCallback((event) => {
        // console.log('MIDI Event:', event); // Optional: Full event details

        switch (event.name) {
            case "End of File":
                console.log("MIDI Player: Playback finished.");
                stateRefs.current.setIsPlaying(false);
                break;

            // ***** ADD DETAILED LOGGING FOR NOTES *****
            case "Note on":
                console.log(
                    `MIDI Player: Note On - Tick: ${event.tick}, Note: ${event.noteName} (#${event.noteNumber}), Vel: ${event.velocity}, Ch: ${event.channel}`
                );
                // Check if velocity is zero or very low!
                if (event.velocity === 0) {
                    console.warn(`MIDI Player: Note On with ZERO velocity detected for ${event.noteName}`);
                }
                break;
            case "Note off":
                console.log(
                    `MIDI Player: Note Off - Tick: ${event.tick}, Note: ${event.noteName} (#${event.noteNumber}), Ch: ${event.channel}`
                );
                break;

            // ***** ADD LOGGING FOR INSTRUMENT CHANGES *****
            case "Program Change":
                console.log(
                    `MIDI Player: Program Change - Tick: ${event.tick}, Ch: ${event.channel}, Instrument: ${event.value}`
                );
                // This tells you which instrument ID the player is trying to load for a channel
                break;

            // You might also log other events like Tempo, Time Signature if debugging timing
            case "Set Tempo":
                console.log(`MIDI Player: Set Tempo - Tick: ${event.tick}, Value: ${event.data} bpm`);
                break;

            default:
                // console.log('MIDI Event:', event.name); // Log other event names if needed
                break;
        }
    }, []); // Dependencies are correct
    // --- Effect for Initializing/Resetting Player (SIMPLIFIED INITIALIZATION) ---
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
            // Make async to await resumeAudioContext
            try {
                console.log("MIDI Player: FileReader onload - initializing MidiPlayer...");
                // Ensure context is ready before Player potentially uses it implicitly
                const ac = await resumeAudioContext();
                if (!ac) {
                    throw new Error("AudioContext not available for MIDI Player");
                }
                console.log(`MIDI Player: AudioContext state before player init: ${ac.state}`);

                // ***** REMOVE ALL OPTIONS - LET midi-player-js AUTO-DETECT soundfont-player *****
                const newPlayer = new MidiPlayer.Player(playerEventHandler);
                console.log("MIDI Player: Instance created WITHOUT explicit options (using auto-detection).");

                // Load the ArrayBuffer AFTER creating the player instance
                newPlayer.loadArrayBuffer(e.target.result);
                console.log("MIDI Player: ArrayBuffer loaded.");

                // Give it a tiny moment in case internal async loading needs to start
                // This is a guess, but sometimes helps race conditions.
                await new Promise((resolve) => setTimeout(resolve, 100));

                setPlayer(newPlayer);
                setIsPlaying(false);
                setError("");
            } catch (err) {
                console.error("MIDI Player: Error initializing:", err);
                setError(`Error initializing player: ${err?.message || err}`);
                setPlayer(null);
            } finally {
                setIsLoading(false); // Ensure loading state is always reset
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
    }, [midiFile, playerEventHandler]); // Dependencies are correct

    // --- File Input Handler (Keep as is) ---
    const handleFileChange = async (event) => {
        await resumeAudioContext(); // Good place to resume
        const file = event.target.files?.[0];
        // ... (rest of file handling logic is fine) ...
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
        await resumeAudioContext(); // Resume before playing
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
        /* (Keep as is) */ if (player && isPlaying) {
            player.pause();
            setIsPlaying(false);
            console.log("MIDI Player: Paused.");
        }
    };
    const handleStop = () => {
        /* (Keep as is) */ if (player) {
            player.stop();
            setIsPlaying(false);
            console.log("MIDI Player: Stopped.");
        }
    };

    // --- Render Component (Add the test button) ---
    return (
        <div style={styles.container}>
            <h2 style={styles.title}>React MIDI Player</h2>

            {/* --- Add the Test Button Here --- */}
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
            {/* --- End Test Button --- */}

            <input
                type="file"
                accept=".mid,.midi,audio/midi,audio/mid,audio/x-midi"
                onChange={handleFileChange}
                disabled={isLoading || isSoundfontTestLoading} // Also disable during test
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

// --- Styles (Keep as is) ---
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
    input: { display: "block", marginBottom: "15px", width: "calc(100% - 10px)" }, // Adjust width slightly
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
