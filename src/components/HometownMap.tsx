import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "leaflet/dist/leaflet.css";

type PinRow = {
  id: string;
  name: string;
  fun_fact: string;
  lat: number;
  lng: number;
};

export default function HometownMap() {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const draftMarkerRef = useRef<any>(null);
  const pinsLayerRef = useRef<any>(null);

  const [name, setName] = useState("");
  const [fact, setFact] = useState("");
  const [draftLatLng, setDraftLatLng] = useState<{ lat: number; lng: number }>({
    lat: 20,
    lng: 0,
  });
  const [status, setStatus] = useState<string>("");

  function makePopupNode(n: string, f: string) {
    const wrap = document.createElement("div");
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = n;

    const body = document.createElement("div");
    body.textContent = f;

    wrap.appendChild(title);
    wrap.appendChild(body);
    return wrap;
  }

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!isMounted) return;
      LRef.current = L;

      // Fix default marker icon paths in bundlers
      // (Leaflet expects images in a certain location.)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const iconRetinaUrl = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const iconUrl = (await import("leaflet/dist/images/marker-icon.png")).default;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const shadowUrl = (await import("leaflet/dist/images/marker-shadow.png")).default;

      L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

      const map = L.map(mapElRef.current!, { zoomControl: true }).setView([20, 0], 2);
      mapRef.current = map;

      // OpenStreetMap tiles (remember attribution)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      pinsLayerRef.current = L.layerGroup().addTo(map);

      // Draft draggable marker
      const draft = L.marker([draftLatLng.lat, draftLatLng.lng], { draggable: true }).addTo(map);
      draftMarkerRef.current = draft;

      draft.on("dragend", () => {
        const pos = draft.getLatLng();
        setDraftLatLng({ lat: pos.lat, lng: pos.lng });
      });

      // Load existing pins
      const { data, error } = await supabase
        .from("pins")
        .select("id,name,fun_fact,lat,lng")
        .order("created_at", { ascending: true })
        .limit(2000);

      if (error) {
        console.error(error);
        setStatus("Couldn’t load pins (check console).");
        return;
      }

      (data as PinRow[]).forEach((p) => {
        const m = L.marker([p.lat, p.lng]);
        const popup = makePopupNode(p.name, p.fun_fact);
        m.bindPopup(popup, { closeButton: false });
        m.on("mouseover", () => m.openPopup());
        m.on("mouseout", () => m.closePopup());
        m.addTo(pinsLayerRef.current);
      });
    }

    init();

    return () => {
      isMounted = false;
      if (mapRef.current) mapRef.current.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPin() {
    setStatus("");

    const trimmedName = name.trim();
    const trimmedFact = fact.trim();

    if (!trimmedName || !trimmedFact) {
      setStatus("Please enter both your name and a fun fact.");
      return;
    }
    if (trimmedName.length > 40) {
      setStatus("Name is too long (max 40 chars).");
      return;
    }
    if (trimmedFact.length > 200) {
      setStatus("Fun fact is too long (max 200 chars).");
      return;
    }

    setStatus("Saving…");

    const { data, error } = await supabase
      .from("pins")
      .insert({
        name: trimmedName,
        fun_fact: trimmedFact,
        lat: draftLatLng.lat,
        lng: draftLatLng.lng,
      })
      .select("id,name,fun_fact,lat,lng")
      .single();

    if (error) {
      console.error(error);
      setStatus("Couldn’t save (check console).");
      return;
    }

    const L = LRef.current;
    const p = data as PinRow;

    const m = L.marker([p.lat, p.lng]);
    const popup = makePopupNode(p.name, p.fun_fact);
    m.bindPopup(popup, { closeButton: false });
    m.on("mouseover", () => m.openPopup());
    m.on("mouseout", () => m.closePopup());
    m.addTo(pinsLayerRef.current);

    setName("");
    setFact("");
    setStatus("Pinned!");
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-xl overflow-hidden border border-neutral-200">
        <div ref={mapElRef} className="h-[420px] w-full" />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
        <input
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 sm:col-span-2"
          placeholder="Something fun about your hometown"
          value={fact}
          onChange={(e) => setFact(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          className="rounded-lg bg-black text-white px-4 py-2 hover:opacity-90"
          onClick={onPin}
        >
          Pin
        </button>
        <div className="text-sm text-neutral-600">
          Draft location: {draftLatLng.lat.toFixed(4)}, {draftLatLng.lng.toFixed(4)}
        </div>
      </div>

      {status && <div className="text-sm text-neutral-700">{status}</div>}
      <div className="text-xs text-neutral-500">
        Tip: drag the marker to your hometown, then click Pin.
      </div>
    </div>
  );
}