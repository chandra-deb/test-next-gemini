// Developer-adjustable configuration for subtitle line replay behavior.
// Modify these constants to tweak how much context (preroll) is included
// before a replayed line and how long after the line ends we wait before
// resetting the playback speed back to normal.

// Seconds of audio to include before the line's start when replaying.
export const REPLAY_PREROLL_SECONDS = 0.25;

// Extra seconds after the nominal line end (in addition to preroll already played)
// before restoring playback speed. Helps avoid early resets due to timing drift.
export const REPLAY_RESET_BUFFER_SECONDS = 0.15;

// (Optional) Default slow replay rates you might expose in UI components.
export const REPLAY_SLOW_RATES = [0.75, 0.5];
