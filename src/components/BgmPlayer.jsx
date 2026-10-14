import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const BGM_SRC = '/assets/bgm/main_theme.mp3'
const STORAGE_KEY = 'dotre_bgm_on'

export default function BgmPlayer() {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const wanted = localStorage.getItem(STORAGE_KEY) === '1'
    if (wanted && audioRef.current) {
      audioRef.current.volume = 0.4
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      localStorage.setItem(STORAGE_KEY, '0')
    } else {
      audio.volume = 0.4
      audio.play().then(() => {
        setPlaying(true)
        localStorage.setItem(STORAGE_KEY, '1')
      }).catch(() => {})
    }
  }

  return createPortal(
    <>
      <audio ref={audioRef} src={BGM_SRC} loop preload="auto" />
      <button
        onClick={toggle}
        aria-label={playing ? 'BGM 끄기' : 'BGM 켜기'}
        className="fixed bottom-4 right-4 z-[9999] flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-lg text-white shadow-lg backdrop-blur-md"
      >
        {playing ? '🔊' : '🔇'}
      </button>
    </>,
    document.body
  )
}