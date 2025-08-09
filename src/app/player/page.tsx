"use client";
import React, { useRef, useState, useEffect } from "react";
import YouTube, { YouTubePlayer, YouTubeProps } from "react-youtube";

const opts: YouTubeProps["opts"] = {
  // height: '390',
  // width: '640',
  playerVars: {
    // https://developers.google.com/youtube/player_parameters
    autoplay: 1,
    //   controls:0,
    rel:0,
    start: 10,
    // end: 15,
    loop: 1,
  },
};

const Player = () => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

   const onPlayerReady = (event: { target: YouTubePlayer }) => {

    playerRef.current = event.target;
  };

  const seekTo = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true);
    }
  };

    const playVideo = () => {
    playerRef.current?.playVideo();
  };

  const pauseVideo = () => {
    playerRef.current?.pauseVideo();
  };

  // Effect to continuously update the current time when video is playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && playerRef.current) {
      interval = setInterval(async () => {
        const time = await playerRef.current?.getCurrentTime();
        if (time !== undefined) {
          setCurrentTime(time);
        }
      }, 50); // Update every 50ms for higher precision tracking
    }

    // Need to learn why return here?
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying]);

  // Format time as MM:SS.mmm (with milliseconds)
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };


  return (
    <div>
      <h1>High</h1>
      
      {/* Display current time with milliseconds precision */}
      <div style={{ marginBottom: "1rem", fontSize: "1.2rem", fontWeight: "bold" }}>
        Current Time: {formatTime(currentTime)}
      </div>
      
      <br></br>
      <YouTube
        videoId="vvHuHgfxc7o"
        loading="eager"
        opts={opts}
        onReady={onPlayerReady}
        onStateChange={(event) => {
          // Update playing state based on player state
          const playerState = event.data;
          setIsPlaying(playerState === 1); // 1 = playing, 2 = paused
        }}
     
      />
      <div style={{ marginTop: "1rem" }}>
        <button onClick={() => seekTo(10)}>Go to 10s</button>
        <button onClick={() => seekTo(30)}>Go to 30s</button>
        <button onClick={playVideo}>Play</button>
        <button onClick={pauseVideo}>Pause</button>
      </div>
    </div>
  );
};

export default Player;
