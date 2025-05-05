import React, { useState, useEffect, useRef, useCallback } from "react";
import MidiPlayer from "midi-player-js";

// IMPORTANT: Replace this with the actual URL to YOUR SoundFont file or compatible directory
// Option 1: Use a pre-hosted one compatible with midi-player-js (check their docs/examples)
const DEFAULT_SOUNDFONT_URL = "https://gleitz.github.io/midi-js-soundfonts/Tabla/"; // Example from midi-player-js docs, might need specific hosting/format
// Option 2: Host your own SF2 file and point to it (ensure CORS is configured if needed)
// const DEFAULT_SOUNDFONT_URL = 'https://your-domain.com/path/to/your/soundfont.sf2';

function HighQualityMidiPlayer({ midiUrl, soundfontUrl = DEFAULT_SOUNDFONT_URL }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const playerRef = useRef(null);
    const audioContextRef = useRef(null);

    // Function to initialize or resume AudioContext
    const initAudioContext = useCallback(async () => {
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error("Web Audio API is not supported in this browser.", e);
                setError("Web Audio API is not supported by your browser.");
                return false;
            }
        }
        // Resume context if suspended (required by modern browsers)
        if (audioContextRef.current.state === "suspended") {
            try {
                await audioContextRef.current.resume();
            } catch (e) {
                console.error("Could not resume audio context:", e);
                setError("Audio playback requires user interaction. Click play again.");
                // Keep context suspended, user needs to interact again
                return false;
            }
        }
        return true;
    }, []);

    // Initialize Player and load SoundFont/MIDI
    useEffect(() => {
        // Do nothing if URLs are not provided
        if (!midiUrl || !soundfontUrl) {
            setIsReady(false);
            // Optionally clean up existing player if URLs are removed
            if (playerRef.current) {
                playerRef.current.stop();
                playerRef.current = null;
                setIsPlaying(false);
            }
            return;
        }

        setIsLoading(true);
        setError(null);
        setIsReady(false);
        setIsPlaying(false); // Reset playback state

        // Ensure AudioContext is ready before proceeding
        initAudioContext()
            .then((contextReady) => {
                if (!contextReady) {
                    setIsLoading(false);
                    // Error state already set by initAudioContext if it failed internally
                    return;
                }

                // Cleanup previous player instance if exists
                if (playerRef.current) {
                    playerRef.current.stop();
                }

                // Initialize MIDI Player
                const newPlayer = new MidiPlayer.Player(function (event) {
                    // Optional: Handle MIDI events (e.g., note on/off, progress)
                    console.log(event);
                });

                // // Load the SoundFont first
                // newPlayer
                //     .loadSoundFont(soundfontUrl, audioContextRef.current)
                //     .then(() => {
                //         console.log("SoundFont loaded successfully.");
                //         // SoundFont loaded, now load the MIDI file
                //         return newPlayer.loadMidiFile(midiUrl);
                //     })
                //     .then(() => {
                //         console.log("MIDI file loaded successfully.");
                //         playerRef.current = newPlayer; // Assign player only after everything is loaded
                //         setIsLoading(false);
                //         setIsReady(true);
                //     })
                //     .catch((err) => {
                //         console.error("Error loading SoundFont or MIDI:", err);
                //         setError(`Failed to load resources: ${err.message || err}`);
                //         setIsLoading(false);
                //         playerRef.current = null; // Ensure ref is null on error
                //     });

                // Handle end of playback
                newPlayer.on("endOfFile", () => {
                    console.log("Playback finished.");
                    setIsPlaying(false);
                    // You might want to seek to the beginning here if needed
                    // playerRef.current?.skipToSeconds(0); // Check library API if needed
                });
            })
            .catch((err) => {
                // Catch errors from initAudioContext promise itself (unlikely here)
                console.error("Error initializing audio context:", err);
                setError("Failed to initialize audio.");
                setIsLoading(false);
            });

        // Cleanup function when component unmounts or dependencies change
        return () => {
            console.log("Cleaning up MIDI Player...");
            if (playerRef.current) {
                playerRef.current.stop();
                playerRef.current = null; // Clear the ref
            }
            setIsPlaying(false);
            setIsReady(false);
            // We don't close the AudioContext, as it's often shared or reused.
            // Let the browser manage its lifecycle or handle it globally if needed.
        };
    }, [midiUrl, soundfontUrl, initAudioContext]); // Rerun effect if URLs change

    // Control Functions
    const handlePlayPause = async () => {
        if (!playerRef.current || isLoading || !isReady) return;

        // Ensure audio context is running before playing
        const contextReady = await initAudioContext();
        if (!contextReady) {
            // Error state handled within initAudioContext
            return;
        }

        if (isPlaying) {
            playerRef.current.pause();
            setIsPlaying(false);
            console.log("Playback paused.");
        } else {
            playerRef.current.play();
            setIsPlaying(true);
            console.log("Playback started.");
        }
    };

    const handleStop = () => {
        if (playerRef.current && isReady) {
            playerRef.current.stop();
            setIsPlaying(false);
            console.log("Playback stopped.");
        }
    };

    return (
        <div className="midi-player">
            <h4>High Quality MIDI Player</h4>
            {isLoading && <p>Loading SoundFont and MIDI file...</p>}
            {error && <p style={{ color: "red" }}>Error: {error}</p>}
            {!isLoading && !error && !isReady && midiUrl && <p>Initializing...</p>}
            {!midiUrl && <p>Please provide a MIDI file URL.</p>}

            {isReady && !error && (
                <div className="controls">
                    <button onClick={handlePlayPause} disabled={isLoading}>
                        {isPlaying ? "Pause" : "Play"}
                    </button>
                    <button onClick={handleStop} disabled={isLoading || !isPlaying}>
                        Stop
                    </button>
                </div>
            )}
            {/* You could add more UI elements here, like a progress bar */}
            {/* Getting accurate progress often requires handling MIDI events */}
            {/* and calculating based on ticks/time signatures, which can be complex. */}
            {/* midi-player-js might offer helpers or specific events for this. */}
        </div>
    );
}

export default HighQualityMidiPlayer;
