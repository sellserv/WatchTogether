import { useEffect, useRef, useCallback } from 'react'
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube'
import type { VideoState } from '../lib/types'

interface Props {
  videoState: VideoState
  onPlay: (currentTime: number) => void
  onPause: (currentTime: number) => void
  onSeek: (currentTime: number) => void
}

export default function VideoPlayer({ videoState, onPlay, onPause, onSeek }: Props) {
  const playerRef = useRef<YouTubePlayer | null>(null)
  const isRemoteUpdate = useRef(false)
  const lastSyncTimestamp = useRef(0)

  const syncPlayer = useCallback(() => {
    const player = playerRef.current
    if (!player || isRemoteUpdate.current) return
    if (videoState.timestamp === lastSyncTimestamp.current) return
    lastSyncTimestamp.current = videoState.timestamp

    isRemoteUpdate.current = true

    const elapsed = (Date.now() - videoState.timestamp) / 1000
    const targetTime = videoState.isPlaying
      ? videoState.currentTime + elapsed
      : videoState.currentTime

    try {
      const currentTime = player.getCurrentTime()
      const diff = Math.abs(currentTime - targetTime)

      if (diff > 2) {
        player.seekTo(targetTime, true)
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
    }, 300)
  }, [videoState])

  useEffect(() => {
    syncPlayer()
  }, [syncPlayer])

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
      onPlay(currentTime)
    }
    // Paused
    else if (state === 2) {
      onPause(currentTime)
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
      <SeekDetector playerRef={playerRef} onSeek={handleSeek} isRemoteUpdate={isRemoteUpdate} />
    </div>
  )
}

function SeekDetector({
  playerRef,
  onSeek,
  isRemoteUpdate,
}: {
  playerRef: React.MutableRefObject<YouTubePlayer | null>
  onSeek: () => void
  isRemoteUpdate: React.MutableRefObject<boolean>
}) {
  const lastTime = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current || isRemoteUpdate.current) return
      try {
        const currentTime = playerRef.current.getCurrentTime()
        const diff = Math.abs(currentTime - lastTime.current)
        if (diff > 2 && lastTime.current > 0) {
          onSeek()
        }
        lastTime.current = currentTime
      } catch {
        // Player not ready
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [playerRef, onSeek, isRemoteUpdate])

  return null
}
