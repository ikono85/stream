import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * PICTURE-IN-PICTURE
 * ==================
 * Detaches the video into a floating window that survives switching tabs or
 * applications. Chromium and Safari expose it to the page; Firefox refuses on
 * purpose and offers its own browser-level control instead, so there the
 * button simply never appears rather than failing under the pointer.
 *
 * Safari shipped the feature before the specification settled and still only
 * answers to the webkit presentation-mode API, so both paths are kept.
 */

interface WebkitVideo extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: string) => boolean
  webkitSetPresentationMode?: (mode: 'picture-in-picture' | 'inline') => void
  webkitPresentationMode?: string
}

export function usePictureInPicture(ref: RefObject<HTMLVideoElement | null>) {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const webkit = video as WebkitVideo

    setSupported(
      (document.pictureInPictureEnabled && !video.disablePictureInPicture) ||
        webkit.webkitSupportsPresentationMode?.('picture-in-picture') === true,
    )

    /* The window can also be closed from its own chrome, so follow the element. */
    const enter = () => setActive(true)
    const leave = () => setActive(false)
    const webkitChange = () => setActive(webkit.webkitPresentationMode === 'picture-in-picture')

    video.addEventListener('enterpictureinpicture', enter)
    video.addEventListener('leavepictureinpicture', leave)
    video.addEventListener('webkitpresentationmodechanged', webkitChange)
    return () => {
      video.removeEventListener('enterpictureinpicture', enter)
      video.removeEventListener('leavepictureinpicture', leave)
      video.removeEventListener('webkitpresentationmodechanged', webkitChange)
    }
  }, [ref])

  const toggle = useCallback(() => {
    const video = ref.current
    if (!video) return
    const webkit = video as WebkitVideo

    if (document.pictureInPictureElement === video) {
      void document.exitPictureInPicture().catch(() => {})
      return
    }
    if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
      void video.requestPictureInPicture().catch(() => {})
      return
    }
    if (webkit.webkitSupportsPresentationMode?.('picture-in-picture')) {
      webkit.webkitSetPresentationMode?.(
        webkit.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture',
      )
    }
  }, [ref])

  return { active, supported, toggle }
}
