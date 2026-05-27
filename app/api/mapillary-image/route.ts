import { NextRequest, NextResponse } from 'next/server'

type ImageRecord = { id: string; lat: number; lng: number }

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat')
  const lng = req.nextUrl.searchParams.get('lng')

  if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
    return NextResponse.json({ images: [], imageId: null }, { status: 400 })
  }

  const token = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN
  if (!token) return NextResponse.json({ images: [], imageId: null })

  const delta = 0.003
  const bbox = `${+lng - delta},${+lat - delta},${+lng + delta},${+lat + delta}`

  try {
    const res = await fetch(
      `https://graph.mapillary.com/images?access_token=${token}&fields=id,geometry&bbox=${bbox}&limit=8&is_pano=true`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return NextResponse.json({ images: [], imageId: null })

    const data = (await res.json()) as {
      data?: { id?: string; geometry?: { coordinates?: number[] } }[]
    }

    const reqLat = Number(lat)
    const reqLng = Number(lng)

    const images: ImageRecord[] = (data?.data ?? [])
      .flatMap((item) => {
        const id = item.id
        const coords = item.geometry?.coordinates
        if (!id || !coords || coords.length < 2) return []
        return [{ id, lat: coords[1], lng: coords[0] }]
      })
      .sort((a, b) => {
        const dA = (a.lat - reqLat) ** 2 + (a.lng - reqLng) ** 2
        const dB = (b.lat - reqLat) ** 2 + (b.lng - reqLng) ** 2
        return dA - dB
      })

    const imageId = images[0]?.id ?? null

    return NextResponse.json({ images, imageId }, {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    })
  } catch {
    return NextResponse.json({ images: [], imageId: null })
  }
}
