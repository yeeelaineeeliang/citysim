"use client";

import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { straightLineCoords } from "@/lib/decodePolyline";

interface Point {
  lat: number;
  lng: number;
}

interface AnimatedSimMapProps {
  homeCoords: Point;
  workplaceCoords?: Point | null;
  routeCoords?: [number, number][];
  workplaceName?: string;
  neighborhoodName?: string;
  isAnimating?: boolean;
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (coords.length >= 2 && !fitted.current) {
      map.fitBounds(coords, { padding: [60, 60] });
      fitted.current = true;
    }
  }, [map, coords]);
  return null;
}

export function AnimatedSimMap({
  homeCoords,
  workplaceCoords,
  routeCoords,
  workplaceName = "Workplace",
  neighborhoodName = "Home",
  isAnimating = false,
}: AnimatedSimMapProps) {
  const [avatarIdx, setAvatarIdx] = useState(0);
  const directionRef = useRef<1 | -1>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allRouteCoords: [number, number][] =
    routeCoords && routeCoords.length >= 2
      ? routeCoords
      : workplaceCoords
        ? straightLineCoords(homeCoords, workplaceCoords)
        : [];

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!isAnimating || allRouteCoords.length < 2) {
      setAvatarIdx(0);
      directionRef.current = 1;
      return;
    }

    intervalRef.current = setInterval(() => {
      setAvatarIdx((prev) => {
        const next = prev + directionRef.current;
        if (next >= allRouteCoords.length - 1) {
          directionRef.current = -1;
          return allRouteCoords.length - 1;
        }
        if (next <= 0) {
          directionRef.current = 1;
          return 0;
        }
        return next;
      });
    }, 80);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAnimating, allRouteCoords.length]);

  const avatarPos: [number, number] | null =
    allRouteCoords.length > 0 ? allRouteCoords[avatarIdx] ?? null : null;

  const boundsCoords: [number, number][] = [
    [homeCoords.lat, homeCoords.lng],
    ...(workplaceCoords ? [[workplaceCoords.lat, workplaceCoords.lng] as [number, number]] : []),
  ];

  return (
    <MapContainer
      center={[homeCoords.lat, homeCoords.lng]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {boundsCoords.length >= 2 && <FitBounds coords={boundsCoords} />}

      {/* Home */}
      <CircleMarker
        center={[homeCoords.lat, homeCoords.lng]}
        radius={10}
        pathOptions={{ color: "#1d6f3e", fillColor: "#2da55e", fillOpacity: 0.9, weight: 2 }}
      >
        <Popup>{neighborhoodName} (home)</Popup>
      </CircleMarker>

      {/* Workplace */}
      {workplaceCoords && (
        <CircleMarker
          center={[workplaceCoords.lat, workplaceCoords.lng]}
          radius={10}
          pathOptions={{ color: "#a0520a", fillColor: "#e8b84b", fillOpacity: 0.9, weight: 2 }}
        >
          <Popup>{workplaceName}</Popup>
        </CircleMarker>
      )}

      {/* Route line */}
      {allRouteCoords.length >= 2 && (
        <Polyline
          positions={allRouteCoords}
          pathOptions={{ color: "#3a7bd5", weight: 2.5, opacity: 0.5, dashArray: "6 4" }}
        />
      )}

      {/* Animated avatar */}
      {avatarPos && (
        <CircleMarker
          center={avatarPos}
          radius={7}
          pathOptions={{ color: "#1a3a6e", fillColor: "#3a7bd5", fillOpacity: 1, weight: 2 }}
        />
      )}
    </MapContainer>
  );
}
