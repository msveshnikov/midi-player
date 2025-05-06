import React, { useState, useEffect, useCallback, useRef } from "react";
import MidiPlayer from "midi-player-js";
import Soundfont from "soundfont-player";

let audioContext = null;
const getAudioContext = () => {
    if (typeof window === "undefined") {
        return null;
    }
    if (!audioContext) {
        window.reactMidiAudioContext =
            window.reactMidiAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        audioContext = window.reactMidiAudioContext;
    }
    return audioContext;
};

const resumeAudioContext = async () => {
    const ac = getAudioContext();
    if (!ac) {
        return null;
    }
    if (ac.state === "suspended") {
        await ac.resume();
    }
    return ac;
};

const getInstrumentName = (programNumber) => {
    const gmInstruments = [
        "acoustic_grand_piano",
        "bright_acoustic_piano",
        "electric_grand_piano",
        "honkytonk_piano",
        "electric_piano_1",
        "electric_piano_2",
        "harpsichord",
        "clavinet",
        "celesta",
        "glockenspiel",
        "music_box",
        "vibraphone",
        "marimba",
        "xylophone",
        "tubular_bells",
        "dulcimer",
        "drawbar_organ",
        "percussive_organ",
        "rock_organ",
        "church_organ",
        "reed_organ",
        "accordion",
        "harmonica",
        "tango_accordion",
        "acoustic_guitar_nylon",
        "acoustic_guitar_steel",
        "electric_guitar_jazz",
        "electric_guitar_clean",
        "electric_guitar_muted",
        "overdriven_guitar",
        "distortion_guitar",
        "guitar_harmonics",
        "acoustic_bass",
        "electric_bass_finger",
        "electric_bass_pick",
        "fretless_bass",
        "slap_bass_1",
        "slap_bass_2",
        "synth_bass_1",
        "synth_bass_2",
        "violin",
        "viola",
        "cello",
        "contrabass",
        "tremolo_strings",
        "pizzicato_strings",
        "orchestral_harp",
        "timpani",
        "string_ensemble_1",
        "string_ensemble_2",
        "synth_strings_1",
        "synth_strings_2",
        "choir_aahs",
        "voice_oohs",
        "synth_choir",
        "orchestra_hit",
        "trumpet",
        "trombone",
        "tuba",
        "muted_trumpet",
        "french_horn",
        "brass_section",
        "synth_brass_1",
        "synth_brass_2",
        "soprano_sax",
        "alto_sax",
        "tenor_sax",
        "baritone_sax",
        "oboe",
        "english_horn",
        "bassoon",
        "clarinet",
        "piccolo",
        "flute",
        "recorder",
        "pan_flute",
        "blown_bottle",
        "shakuhachi",
        "whistle",
        "ocarina",
        "lead_1_square",
        "lead_2_sawtooth",
        "lead_3_calliope",
        "lead_4_chiff",
        "lead_5_charang",
        "lead_6_voice",
        "lead_7_fifths",
        "lead_8_bass_lead",
        "pad_1_new_age",
        "pad_2_warm",
        "pad_3_polysynth",
        "pad_4_choir",
        "pad_5_bowed",
        "pad_6_metallic",
        "pad_7_halo",
        "pad_8_sweep",
        "fx_1_rain",
        "fx_2_soundtrack",
        "fx_3_crystal",
        "fx_4_atmosphere",
        "fx_5_brightness",
        "fx_6_goblins",
        "fx_7_echoes",
        "fx_8_sci_fi",
        "sitar",
        "banjo",
        "shamisen",
        "koto",
        "kalimba",
        "bagpipe",
        "fiddle",
        "shanai",
        "tinkle_bell",
        "agogo",
        "steel_drums",
        "woodblock",
        "taiko_drum",
        "melodic_tom",
        "synth_drum",
        "reverse_cymbal",
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

const MidiPlayerComponent = () => {
    const [midiFile, setMidiFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const [player, setPlayer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const instrumentsRef = useRef({});
    const channelInstrumentsRef = useRef({});
    const activeNotesRef = useRef({});
    const soundfontOutputRef = useRef(null);

    const loadInstrument = useCallback(async (instrumentName) => {
        const ac = getAudioContext();
        if (!ac) throw new Error("AudioContext not available.");
        if (instrumentsRef.current[instrumentName]) {
            return instrumentsRef.current[instrumentName];
        }
        await resumeAudioContext();
        try {
            const instrument = await Soundfont.instrument(ac, instrumentName);
            instrumentsRef.current[instrumentName] = instrument;
            return instrument;
        } catch {
            if (!instrumentsRef.current["acoustic_grand_piano"]) {
                instrumentsRef.current["acoustic_grand_piano"] = await Soundfont.instrument(ac, "acoustic_grand_piano");
            }
            instrumentsRef.current[instrumentName] = instrumentsRef.current["acoustic_grand_piano"];
            return instrumentsRef.current["acoustic_grand_piano"];
        }
    }, []);

    const createSoundfontOutput = useCallback(() => {
        const ac = getAudioContext();
        if (!ac) return null;
        for (let i = 0; i < 16; i++) {
            channelInstrumentsRef.current[i] = getInstrumentName(0);
        }
        loadInstrument(getInstrumentName(0)).catch(() => {});

        return {
            playNote: async (noteName, channel, velocity) => {
                if (!velocity || velocity === 0) return;
                const instrumentName = channelInstrumentsRef.current[channel] || getInstrumentName(0);

                const instrument = await loadInstrument(instrumentName);
                const gain = velocity / 127;
                const playingNode = instrument.play(noteName, ac.currentTime, { gain });
                const noteId = `${channel}-${noteName}`;
                activeNotesRef.current[noteId] = playingNode;
            },
            stopNote: (noteName, channel) => {
                const noteId = `${channel}-${noteName}`;
                if (activeNotesRef.current[noteId]) {
                    activeNotesRef.current[noteId].stop();
                    delete activeNotesRef.current[noteId];
                }
            },
            programChange: async (channel, program) => {
                const instrumentName = getInstrumentName(program);
                channelInstrumentsRef.current[channel] = instrumentName;
                await loadInstrument(instrumentName);
            },
            pitchBend: () => {},
            controlChange: () => {},
        };
    }, [loadInstrument]);

    const midiEventHandler = useCallback((event) => {
        if (!soundfontOutputRef.current) return;
        switch (event.name) {
            case "Note on":
                if (event.velocity > 0) {
                    soundfontOutputRef.current.playNote(event.noteName, event.channel, event.velocity);
                }
                break;
            case "Program Change":
                soundfontOutputRef.current.programChange(event.channel, event.value);
                break;
            case "End of File":
                setIsPlaying(false);
                break;
            case "Pitch Bend":
                soundfontOutputRef.current.pitchBend(event.channel, event.value);
                break;
            case "Controller Change":
                soundfontOutputRef.current.controlChange(event.channel, event.controllerNumber, event.value);
                break;
            default:
                break;
        }
    }, []);

    useEffect(() => {
        const cleanup = () => {
            if (player) {
                player.stop();
            }
            setPlayer(null);
            setIsPlaying(false);
            soundfontOutputRef.current = null;
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
        cleanup();

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await resumeAudioContext();
                soundfontOutputRef.current = createSoundfontOutput();
                if (!soundfontOutputRef.current) throw new Error("Soundfont init failed");
                const newPlayer = new MidiPlayer.Player(midiEventHandler);
                newPlayer.loadArrayBuffer(e.target.result);
                await new Promise((r) => setTimeout(r, 50));
                setPlayer(newPlayer);
                setIsPlaying(false);
            } catch (err) {
                setError(err.message || "Initialization error");
                setPlayer(null);
                soundfontOutputRef.current = null;
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError("Error reading the MIDI file.");
            setIsLoading(false);
            setPlayer(null);
            setFileName("");
            soundfontOutputRef.current = null;
        };
        reader.readAsArrayBuffer(midiFile);

        return cleanup;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [midiFile, midiEventHandler, createSoundfontOutput]); // Dependencies: effect runs if these change

    const handleFileChange = async (event) => {
        await resumeAudioContext();
        const file = event.target.files?.[0];
        if (file) {
            const validTypes = ["audio/midi", "audio/mid", "audio/x-midi"];
            const validExt = [".mid", ".midi"];
            const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
            if (validTypes.includes(file.type.toLowerCase()) || validExt.includes(ext)) {
                setMidiFile(file);
                setError("");
            } else {
                setMidiFile(null);
                setFileName("");
                setError(`Invalid file type: "${file.type || ext}".`);
            }
        } else {
            setMidiFile(null);
            setFileName("");
        }
        if (event.target) event.target.value = null;
    };

    const handlePlay = async () => {
        await resumeAudioContext();
        if (player && !isPlaying) {
            try {
                player.play();
                setIsPlaying(true);
                setError("");
            } catch (err) {
                setError(err.message || "Playback error");
                setIsPlaying(false);
            }
        } else if (!player) {
            setError("Please load a MIDI file first.");
        }
    };

    const handlePause = () => {
        if (player && isPlaying) {
            player.pause();
            setIsPlaying(false);
        }
    };

    const handleStop = () => {
        if (player) {
            player.stop();
            setIsPlaying(false);
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>React MIDI Player (Multi-Instrument)</h2>
            <input
                type="file"
                accept=".mid,.midi,audio/midi,audio/mid,audio/x-midi"
                onChange={handleFileChange}
                disabled={isLoading}
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
    input: {
        display: "block",
        marginBottom: "20px",
        width: "100%",
        padding: "8px",
        boxSizing: "border-box",
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
    loading: {
        color: "#ff9800",
        fontWeight: "bold",
        textAlign: "center",
        margin: "15px 0",
    },
    error: {
        color: "#d32f2f",
        fontWeight: "bold",
        marginTop: "15px",
        padding: "10px",
        border: "1px solid #fbc0c0",
        borderRadius: "4px",
        backgroundColor: "#ffebee",
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
    },
    controls: {
        marginTop: "25px",
        display: "flex",
        gap: "15px",
        justifyContent: "center",
    },
    button: {
        padding: "10px 18px",
        fontSize: "1em",
        cursor: "pointer",
        borderRadius: "4px",
        border: "1px solid #ccc",
        backgroundColor: "#f0f0f0",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
    },
};

export default MidiPlayerComponent;
