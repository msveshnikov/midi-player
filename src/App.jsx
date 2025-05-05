// src/components/MidiPlayerComponent.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import MidiPlayer from 'midi-player-js';
import Soundfont from 'soundfont-player'; // Import Soundfont directly

// --- Global variable to hold the AudioContext ---
// We only want one AudioContext instance for the lifetime of the app window.
let audioContext = null;
const getAudioContext = () => {
    if (!audioContext) {
        console.log('Creating new AudioContext');
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
};

// Function to resume AudioContext on user interaction
const resumeAudioContext = async () => {
    const ac = getAudioContext();
    if (ac.state === 'suspended') {
        console.log('Resuming AudioContext...');
        try {
            await ac.resume();
            console.log('AudioContext Resumed.');
        } catch (err) {
            console.error("Error resuming AudioContext:", err);
        }
    }
};


const MidiPlayerComponent = () => {
    // State variables
    const [midiFile, setMidiFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [player, setPlayer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Refs for state setters (good practice)
    const stateRefs = useRef();
    stateRefs.current = { setIsPlaying, setError };

    // Event Handler for MidiPlayer
    const playerEventHandler = useCallback((event) => {
        // Optional: Add more detailed logging if needed
        // console.log('MIDI Event:', event);

        switch (event.name) {
            case 'End of File':
                console.log('Playback finished.');
                stateRefs.current.setIsPlaying(false);
                break;
            case 'Note on':
                // console.log('Note On:', event.noteName, event.velocity);
                break;
            // Add more cases if needed
            default:
                break;
        }
    }, []); // Empty dependency array is correct here due to using refs

    // Effect for Initializing/Resetting Player
    useEffect(() => {
        const cleanup = () => {
            if (player) {
                console.log('Stopping and cleaning up player.');
                player.stop();
                setPlayer(null);
                setIsPlaying(false);
            }
        };

        if (!midiFile) {
            cleanup();
            setIsLoading(false);
            setFileName('');
            return;
        }

        setIsLoading(true);
        setError('');
        setFileName(midiFile.name);

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                console.log('FileReader onload - initializing MidiPlayer...');
                // Ensure AudioContext is available before creating the player
                // It might still be suspended, but it needs to exist.
                getAudioContext();

                const newPlayer = new MidiPlayer.Player(playerEventHandler);

                // IMPORTANT: Pass the AudioContext to the Player's options
                // While not explicitly documented for MidiPlayer itself,
                // it often passes options down to SoundfontPlayer or uses a shared context.
                // Let's also try initializing Soundfont explicitly first.
                // This doesn't hurt and might help underlying mechanisms.
                Soundfont.instrument(getAudioContext(), 'acoustic_grand_piano')
                  .then(() => {
                      console.log('Dummy instrument load ok (ensures Soundfont is warm).');

                      // Now load the MIDI data
                      newPlayer.loadArrayBuffer(e.target.result);
                      console.log('MIDI ArrayBuffer loaded.');

                      setPlayer(newPlayer);
                      setIsPlaying(false);
                      setError('');
                      setIsLoading(false); // Loading finished
                  })
                  .catch(err => {
                    console.error("Error pre-warming Soundfont:", err);
                    // Proceed anyway, maybe it works without pre-warming
                    // but set an error message
                    newPlayer.loadArrayBuffer(e.target.result);
                    console.log('MIDI ArrayBuffer loaded (Soundfont pre-warm failed).');
                    setPlayer(newPlayer);
                    setIsPlaying(false);
                    setError(`Soundfont init error: ${err?.message || err}. Playback might fail.`);
                    setIsLoading(false); // Loading finished
                  });

            } catch (err) {
                console.error("Error initializing MIDI player:", err);
                setError(`Error initializing player: ${err?.message || err}`);
                setPlayer(null);
                setIsLoading(false);
            }
            // Removed finally block here, moved setIsLoading(false) inside the promise/catch
        };

        reader.onerror = (e) => {
            console.error("Error reading MIDI file:", e);
            setError('Error reading the MIDI file.');
            setIsLoading(false);
            setPlayer(null);
            setFileName('');
        };

        reader.readAsArrayBuffer(midiFile);

        return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [midiFile, playerEventHandler]); // playerEventHandler is stable

    // --- File Input Handler ---
    const handleFileChange = async (event) => {
        // Try to resume audio context on file selection too (good practice)
        await resumeAudioContext();

        const file = event.target.files?.[0];
        if (file) {
             const validTypes = ['audio/midi', 'audio/mid', 'audio/x-midi'];
             const validExtensions = ['.mid', '.midi'];
             const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

            if (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) {
                setMidiFile(file);
                setError('');
            } else {
                setMidiFile(null);
                setFileName('');
                setError('Please select a valid MIDI file (.mid, .midi)');
             }
        } else {
            setMidiFile(null);
            setFileName('');
        }
        if (event.target) {
            event.target.value = null;
        }
    };

    // --- Playback Controls ---
    const handlePlay = async () => {
        // *** Crucial: Resume AudioContext on Play attempt ***
        await resumeAudioContext();

        if (player && !isPlaying) {
            console.log("Attempting player.play()...");
            try {
                player.play();
                setIsPlaying(true);
                setError('');
                console.log("Player is now playing.");
            } catch (err) {
                console.error("Error during player.play():", err);
                setError(`Playback error: ${err?.message || err}`);
                setIsPlaying(false); // Ensure state reflects failure
            }
        } else {
             console.log("Play ignored:", !player ? "No player" : "Already playing");
        }
    };

    const handlePause = () => {
        if (player && isPlaying) {
            console.log("Attempting player.pause()...");
            player.pause();
            setIsPlaying(false);
            console.log("Player paused.");
        }
    };

    const handleStop = () => {
        if (player) {
            console.log("Attempting player.stop()...");
            player.stop();
            setIsPlaying(false);
            console.log("Player stopped.");
        }
    };

    // --- Render Component ---
    return (
        <div style={styles.container}>
            <h2 style={styles.title}>React MIDI Player</h2>

            <input
                type="file"
                accept=".mid,.midi,audio/midi,audio/mid,audio/x-midi"
                onChange={handleFileChange}
                disabled={isLoading}
                style={styles.input}
            />

            {fileName && <p style={styles.fileName}>Loaded: {fileName}</p>}

            {isLoading && <p style={styles.loading}>Loading MIDI & instruments...</p>}

            {error && <p style={styles.error}>Error: {error}</p>}

            <div style={styles.controls}>
                <button
                    onClick={handlePlay}
                    disabled={!player || isPlaying || isLoading}
                    style={styles.button}
                >
                    Play
                </button>
                <button
                    onClick={handlePause}
                    disabled={!player || !isPlaying || isLoading}
                    style={styles.button}
                >
                    Pause
                </button>
                <button
                    onClick={handleStop}
                    disabled={!player || isLoading}
                    style={styles.button}
                >
                    Stop
                </button>
            </div>
        </div>
    );
};

// Basic styling (keep as is)
const styles = {
    container: {
        fontFamily: 'sans-serif',
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        maxWidth: '500px',
        margin: '20px auto',
        backgroundColor: '#f9f9f9',
    },
    title: {
        textAlign: 'center',
        color: '#333',
        marginBottom: '20px',
    },
    input: {
        display: 'block',
        marginBottom: '15px',
    },
    fileName: {
        fontStyle: 'italic',
        color: '#555',
        marginBottom: '10px',
        wordBreak: 'break-all',
    },
    loading: {
        color: 'orange',
        fontWeight: 'bold',
    },
    error: {
        color: 'red',
        fontWeight: 'bold',
        marginTop: '10px',
        wordBreak: 'break-word',
    },
    controls: {
        marginTop: '20px',
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
    },
    button: {
        padding: '8px 15px',
        fontSize: '1em',
        cursor: 'pointer',
        borderRadius: '4px',
        border: '1px solid #ccc',
        backgroundColor: '#eee',
    },
};

export default MidiPlayerComponent;