"use client";

import { useEffect } from "react";

import { track, type TrackName, type TrackParams } from "@/lib/track";

/** Wysyła jedno zdarzenie po wyświetleniu strony (np. oglądanie profilu biura, wysłane zapytanie). */
export function TrackEvent({ name, params = {}, eventId, serverSent = false }: {
  name: TrackName;
  params?: TrackParams;
  eventId?: string;
  serverSent?: boolean;
}) {
  const key = JSON.stringify([name, params, eventId]);
  useEffect(() => {
    track(name, params, { eventId, serverSent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
