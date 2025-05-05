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
    const instrumentsRef = useRef({}); // src/components/MidiPlayerComponent.jsx

    // Channel to instrument mapping
    const channelInstrumentsRef = useRef({});

    // Map GM instrument numbers to soundfont names
    const getInstrumentName = (programNumber) => {
        // General MIDI instrument map (0-127)
        const gmInstruments = [
            // Piano (0-7)
            "acoustic_grand_piano",
            "bright_acoustic_piano",
            "electric_grand_piano",
            "honkytonk_piano",
            "electric_piano_1",
            "electric_piano_2",
            "harpsichord",
            "clavinet",
            // Chromatic Percussion (8-15)
            "celesta",
            "glockenspiel",
            "music_box",
            "vibraphone",
            "marimba",
            "xylophone",
            "tubular_bells",
            "dulcimer",
            // Organ (16-23)
            "drawbar_organ",
            "percussive_organ",
            "rock_organ",
            "church_organ",
            "reed_organ",
            "accordion",
            "harmonica",
            "tango_accordion",
            // Guitar (24-31)
            "acoustic_guitar_nylon",
            "acoustic_guitar_steel",
            "electric_guitar_jazz",
            "electric_guitar_clean",
            "electric_guitar_muted",
            "overdriven_guitar",
            "distortion_guitar",
            "guitar_harmonics",
            // Bass (32-39)
            "acoustic_bass",
            "electric_bass_finger",
            "electric_bass_pick",
            "fretless_bass",
            "slap_bass_1",
            "slap_bass_2",
            "synth_bass_1",
            "synth_bass_2",
            // Strings (40-47)
            "violin",
            "viola",
            "cello",
            "contrabass",
            "tremolo_strings",
            "pizzicato_strings",
            "orchestral_harp",
            "timpani",
            // Ensemble (48-55)
            "string_ensemble_1",
            "string_ensemble_2",
            "synth_strings_1",
            "synth_strings_2",
            "choir_aahs",
            "voice_oohs",
            "synth_choir",
            "orchestra_hit",
            // Brass (56-63)
            "trumpet",
            "trombone",
            "tuba",
            "muted_trumpet",
            "french_horn",
            "brass_section",
            "synth_brass_1",
            "synth_brass_2",
            // Reed (64-71)
            "soprano_sax",
            "alto_sax",
            "tenor_sax",
            "baritone_sax",
            "oboe",
            "english_horn",
            "bassoon",
            "clarinet",
            // Pipe (72-79)
            "piccolo",
            "flute",
            "recorder",
            "pan_flute",
            "blown_bottle",
            "shakuhachi",
            "whistle",
            "ocarina",
            // Synth Lead (80-87)
            "lead_1_square",
            "lead_2_sawtooth",
            "lead_3_calliope",
            "lead_4_chiff",
            "lead_5_charang",
            "lead_6_voice",
            "lead_7_fifths",
            "lead_8_bass_lead",
            // Synth Pad (88-95)
            "pad_1_new_age",
            "pad_2_warm",
            "pad_3_polysynth",
            "pad_4_choir",
            "pad_5_bowed",
            "pad_6_metallic",
            "pad_7_halo",
            "pad_8_sweep",
            // Synth Effects (96-103)
            "fx_1_rain",
            "fx_2_soundtrack",
            "fx_3_crystal",
            "fx_4_atmosphere",
            "fx_5_brightness",
            "fx_6_goblins",
            "fx_7_echoes",
            "fx_8_sci_fi",
            // Ethnic (104-111)
            "sitar",
            "banjo",
            "shamisen",
            "koto",
            "kalimba",
            "bagpipe",
            "fiddle",
            "shanai",
            // Percussive (112-119)
            "tinkle_bell",
            "agogo",
            "steel_drums",
            "woodblock",
            "taiko_drum",
            "melodic_tom",
            "synth_drum",
            "reverse_cymbal",
            // Sound Effects (120-127)
            "guitar_fret_noise",
            "breath_noise",
            "seashore",
            "bird_tweet",
            "telephone_ring",
            "helicopter",
            "applause",
            "gunshot",
        ];

        return gmInstruments[programNumber] || "acoustic_grand_piano";
    };

    // --- Load Soundfont instruments ---
    const loadInstrument = async (instrument = "acoustic_grand_piano", ac) => {
        try {
            if (!instrumentsRef.current[instrument]) {
                console.log(`Loading instrument: ${instrument}`);
                try {
                    instrumentsRef.current[instrument] = await Soundfont.instrument(ac, instrument);
                    console.log(`Instrument loaded: ${instrument}`);
                } catch (err) {
                    console.error(`Failed to load instrument ${instrument}, falling back to piano:`, err);
                    // If an instrument fails to load, fall back to piano (which should always work)
                    if (instrument !== "acoustic_grand_piano") {
                        instrumentsRef.current[instrument] =
                            instrumentsRef.current["acoustic_grand_piano"] ||
                            (await Soundfont.instrument(ac, "acoustic_grand_piano"));
                    } else {
                        throw err; // Re-throw if even piano fails
                    }
                }
            }
            return instrumentsRef.current[instrument];
        } catch (err) {
            console.error(`Critical error loading instrument ${instrument}:`, err);
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

            // Initialize default instruments for each channel (0-15)
            // Channel 9 (index 10) is reserved for percussion in GM standard
            for (let i = 0; i < 16; i++) {
                channelInstrumentsRef.current[i] = i === 9 ? "percussion" : "acoustic_grand_piano";
            }

            // Preload the default piano instrument
            await loadInstrument("acoustic_grand_piano", ac);

            // Create our soundfont output handler
            return {
                playNote: async (note, channel) => {
                    try {
                        // Get the instrument assigned to this channel
                        const instrumentName = channelInstrumentsRef.current[channel];

                        // Get the instrument from our cache or load it
                        const instrument =
                            instrumentsRef.current[instrumentName] || (await loadInstrument(instrumentName, ac));

                        if (note && instrument) {
                            console.log(
                                `Playing note: ${note} on channel: ${channel} with instrument: ${instrumentName}`
                            );
                            instrument.play(note);
                        }
                    } catch (err) {
                        console.error(`Error playing note ${note} on channel ${channel}:`, err);
                    }
                },

                programChange: async (channel, program) => {
                    try {
                        // Skip percussion channel (9) as it's special in MIDI
                        if (channel === 9) return;

                        const instrumentName = getInstrumentName(program);
                        console.log(
                            `Program change on channel ${channel} to instrument ${program} (${instrumentName})`
                        );

                        // Update the channel's instrument
                        channelInstrumentsRef.current[channel] = instrumentName;

                        // Preload the instrument
                        await loadInstrument(instrumentName, ac);
                    } catch (err) {
                        console.error(`Error changing program on channel ${channel}:`, err);
                    }
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

                // Create player with our soundfont output connected via event handler
                const newPlayer = new MidiPlayer.Player((event) => {
                    // Handle MIDI events and route to our custom output
                    if (event.name === "Note on" && event.velocity > 0) {
                        soundfontOutput.playNote(event.noteName, event.channel);
                    }
                    // Also call the original event handler for logging
                    playerEventHandler(event);
                });

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
    }, [midiFile, createSoundfontOutput,  playerEventHandler]);

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
