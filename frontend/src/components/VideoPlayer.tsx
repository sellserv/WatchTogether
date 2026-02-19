import { useEffect, useRef, useCallback } from 'react'
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube'
import type { VideoState } from '../lib/types'

interface Props {
  videoState: VideoState
  onPlay: (currentTime: number) => void
  onPause: (currentTime: number) => void
  onSeek: (currentTime: number) => void
  onEnd?: () => void
}

export default function VideoPlayer({ videoState, onPlay, onPause, onSeek, onEnd }: Props) {
  const playerRef = useRef<YouTubePlayer | null>(null)
  const isRemoteUpdate = useRef(false)
  const lastProcessedSeq = useRef(0)
  const seekDetectorLastTime = useRef(0)
  const playDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pauseDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncPlayer = useCallback(() => {
    const player = playerRef.current
    if (!player || isRemoteUpdate.current) return
    if (videoState.seq <= lastProcessedSeq.current) return
    lastProcessedSeq.current = videoState.seq

    isRemoteUpdate.current = true

    const elapsed = (Date.now() - videoState.timestamp) / 1000
    const targetTime = videoState.isPlaying
      ? videoState.currentTime + elapsed
      : videoState.currentTime

    try {
      const currentTime = player.getCurrentTime()
      const diff = Math.abs(currentTime - targetTime)

      if (diff > 1.5) {
        player.seekTo(targetTime, true)
        // Update SeekDetector so it doesn't detect this sync seek as user-initiated
        seekDetectorLastTime.current = targetTime
      }

      const playerState = player.getPlayerState()
      if (videoState.isPlaying && playerState !== 1) {
        player.playVideo()
      } else if (!videoState.isPlaying && playerState === 1) {
        player.pauseVideo()
      }

      if (player.getPlaybackRate() !== videoState.playbackRate) {
        player.setPlaybackRate(videoState.playbackRate)
      }
    } catch {
      // Player not ready yet
    }

    setTimeout(() => {
      isRemoteUpdate.current = false
    }, 800)
  }, [videoState])

  useEffect(() => {
    syncPlayer()
  }, [syncPlayer])

  // Clean up debounce timers on unmount
  useEffect(() => {
    return () => {
      if (playDebounceTimer.current) clearTimeout(playDebounceTimer.current)
      if (pauseDebounceTimer.current) clearTimeout(pauseDebounceTimer.current)
    }
  }, [])

  const onReady = (event: YouTubeEvent) => {
    playerRef.current = event.target
    syncPlayer()
  }

  const onStateChange = (event: YouTubeEvent) => {
    if (isRemoteUpdate.current) return

    const player = event.target
    const state = event.data
    const currentTime = player.getCurrentTime()

    // Playing
    if (state === 1) {
      if (pauseDebounceTimer.current) {
        clearTimeout(pauseDebounceTimer.current)
        pauseDebounceTimer.current = null
      }
      if (playDebounceTimer.current) clearTimeout(playDebounceTimer.current)
      playDebounceTimer.current = setTimeout(() => {
        onPlay(currentTime)
        playDebounceTimer.current = null
      }, 150)
    }
    // Paused
    else if (state === 2) {
      if (playDebounceTimer.current) {
        clearTimeout(playDebounceTimer.current)
        playDebounceTimer.current = null
      }
      if (pauseDebounceTimer.current) clearTimeout(pauseDebounceTimer.current)
      pauseDebounceTimer.current = setTimeout(() => {
        onPause(currentTime)
        pauseDebounceTimer.current = null
      }, 150)
    }
    // Ended
    else if (state === 0) {
      onEnd?.()
    }
  }

  const handleSeek = () => {
    if (isRemoteUpdate.current || !playerRef.current) return
    const currentTime = playerRef.current.getCurrentTime()
    onSeek(currentTime)
  }

  return (
    <div className="absolute inset-0">
      <YouTube
        videoId={videoState.videoId}
        className="w-full h-full"
        iframeClassName="w-full h-full"
        opts={{
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
        }}
        onReady={onReady}
        onStateChange={onStateChange}
        onPlaybackRateChange={() => {}}
        onEnd={() => {}}
      />
      {/* Invisible overlay to capture seek events via timeupdate polling */}
      <SeekDetector playerRef={playerRef} onSeek={handleSeek} isRemoteUpdate={isRemoteUpdate} seekDetectorLastTime={seekDetectorLastTime} />
    </div>
  )
}

function SeekDetector({
  playerRef,
  onSeek,
  isRemoteUpdate,
  seekDetectorLastTime,
}: {
  playerRef: React.MutableRefObject<YouTubePlayer | null>
  onSeek: () => void
  isRemoteUpdate: React.MutableRefObject<boolean>
  seekDetectorLastTime: React.MutableRefObject<number>
}) {
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current || isRemoteUpdate.current) return
      try {
        const currentTime = playerRef.current.getCurrentTime()
        const diff = Math.abs(currentTime - seekDetectorLastTime.current)
        if (diff > 2 && seekDetectorLastTime.current > 0) {
          onSeek()
        }
        seekDetectorLastTime.current = currentTime
      } catch {
        // Player not ready
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [playerRef, onSeek, isRemoteUpdate, seekDetectorLastTime])

  return null
}
