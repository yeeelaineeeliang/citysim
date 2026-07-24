"use client"

import { useEffect, useRef, useState } from "react"
import type { Viewer as MapillaryViewer } from "mapillary-js"
import "mapillary-js/dist/mapillary.css"

interface Props {
  readonly lat: number
  readonly lng: number
  /** Reports whether street imagery exists here so the parent can keep its gradient fallback. */
  readonly onImageryStatus?: (available: boolean) => void
}

/**
 * Full-bleed, non-interactive street panorama for the cinematic 4-act mode.
 * Drifts slowly (~360° over the length of a run) so the scene feels alive
 * behind the narrative. Mounted once per run — season is conveyed by the
 * tint and atmosphere layers above it, not by remounting imagery.
 */
export function CinematicStreetPano({ lat, lng, onImageryStatus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<MapillaryViewer | null>(null)
  const statusRef = useRef(onImageryStatus)
  statusRef.current = onImageryStatus
  const [imageId, setImageId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Nearest pano for this neighborhood — same public endpoint idle mode uses.
  useEffect(() => {
    let cancelled = false
    setImageId(null)
    setReady(false)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    fetch(`/api/mapillary-image?lat=${lat}&lng=${lng}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: unknown) => {
        clearTimeout(timeout)
        if (cancelled) return
        const id = (data as { imageId?: string | null })?.imageId ?? null
        if (id) setImageId(id)
        else statusRef.current?.(false)
      })
      .catch(() => {
        clearTimeout(timeout)
        if (!cancelled) statusRef.current?.(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeout)
    }
  }, [lat, lng])

  useEffect(() => {
    if (!containerRef.current || !imageId) return

    let cancelled = false
    let driftTimer: number | null = null
    let failTimer: number | null = null

    import("mapillary-js").then(({ Viewer }) => {
      if (cancelled || !containerRef.current) return

      viewerRef.current?.remove()

      const viewer = new Viewer({
        accessToken: process.env.NEXT_PUBLIC_MAPILLARY_TOKEN ?? "",
        container: containerRef.current,
        imageId,
        component: {
          cover: false,
          sequence: false,
          direction: false,
          zoom: false,
          keyboard: false,
          pointer: false,
          bearing: false,
        },
      })

      // The SDK can fail to fetch this imageId (bad token, deleted/private
      // image, rate limit) as an internal rejection with no "image" event and
      // no error callback — the layer would otherwise stay invisible forever.
      let imageLoaded = false
      failTimer = window.setTimeout(() => {
        if (!cancelled && !imageLoaded) {
          statusRef.current?.(false)
          viewer.remove()
          if (viewerRef.current === viewer) viewerRef.current = null
        }
      }, 8000)

      viewer.on("image", () => {
        if (cancelled) return
        imageLoaded = true
        if (failTimer !== null) window.clearTimeout(failTimer)
        setReady(true)
        statusRef.current?.(true)
      })

      // Slow cinematic pan: +0.0004 of the pano width every 50ms ≈ full turn in ~2 min.
      driftTimer = window.setInterval(() => {
        viewer
          .getCenter()
          .then((center) => {
            if (!cancelled) viewer.setCenter([(center[0] + 0.0004) % 1, center[1]])
          })
          .catch(() => { /* viewer mid-transition */ })
      }, 50)

      viewerRef.current = viewer
    }).catch(() => {
      if (!cancelled) statusRef.current?.(false)
    })

    return () => {
      cancelled = true
      if (driftTimer !== null) window.clearInterval(driftTimer)
      if (failTimer !== null) window.clearTimeout(failTimer)
      viewerRef.current?.remove()
      viewerRef.current = null
    }
  }, [imageId])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-1000"
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden="true"
    />
  )
}
