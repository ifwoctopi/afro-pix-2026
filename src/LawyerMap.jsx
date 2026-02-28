import React, { useEffect, useRef, useState } from "react";

const mapContainerStyle = { width: "100%", height: "420px" };
const defaultCenter = { lat: 39.8283, lng: -98.5795 };
const SCRIPT_ID = "google-maps-script";

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildInfoContent(place) {
  const fallbackAddressLabel = place.formattedAddress ? `Advisor near ${place.formattedAddress.split(",")[0]}` : "Legal Advisor";
  const resolvedName = place.displayName?.text || (typeof place.displayName === "string" ? place.displayName : "") || (place.name && !String(place.name).startsWith("places/") ? place.name : "") || fallbackAddressLabel;
  const name = escapeHtml(resolvedName);
  const rating = place.rating ? `⭐ ${place.rating}${place.userRatingCount ? ` (${place.userRatingCount})` : ""}` : "⭐ No rating";
  const address = escapeHtml(place.formattedAddress || "Address unavailable");
  const phone = escapeHtml(place.nationalPhoneNumber || "Not listed");
  const websiteLink = place.websiteURI
    ? `<a href="${escapeHtml(place.websiteURI)}" target="_blank" rel="noopener noreferrer">Website</a>`
    : "No website listed";
  const mapsLink = place.googleMapsURI
    ? `<a href="${escapeHtml(place.googleMapsURI)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
    : "";
  const firstPhoto = Array.isArray(place.photos) ? place.photos[0] : null;
  const photoUrl = firstPhoto && typeof firstPhoto.getURI === "function"
    ? firstPhoto.getURI({ maxWidth: 320, maxHeight: 180 })
    : "";
  const photoAttributionText = firstPhoto?.authorAttributions?.[0]?.displayName
    ? `Photo: ${escapeHtml(firstPhoto.authorAttributions[0].displayName)}`
    : "";
  const photoBlock = photoUrl
    ? `
      <div style="margin:0 0 8px 0;">
        <img src="${escapeHtml(photoUrl)}" alt="${name}" style="width:100%;max-width:240px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #dfc2a1;" />
        ${photoAttributionText ? `<div style="font-size:11px;color:#7b6753;margin-top:4px;">${photoAttributionText}</div>` : ""}
      </div>
    `
    : "";
  const openNow = typeof place.regularOpeningHours?.openNow === "boolean"
    ? (place.regularOpeningHours.openNow ? "Open now" : "Closed now")
    : "Hours unavailable";
  const businessStatus = escapeHtml(place.businessStatus || "Status unavailable");

  return `
    <div style="max-width:260px;line-height:1.45;font-size:13px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:6px;">${name}</div>
      ${photoBlock}
      <div style="margin-bottom:4px;">${rating}</div>
      <div style="margin-bottom:4px;"><strong>Address:</strong> ${address}</div>
      <div style="margin-bottom:4px;"><strong>Phone:</strong> ${phone}</div>
      <div style="margin-bottom:4px;"><strong>Hours:</strong> ${escapeHtml(openNow)}</div>
      <div style="margin-bottom:6px;"><strong>Status:</strong> ${businessStatus}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">${websiteLink}${mapsLink ? ` | ${mapsLink}` : ""}</div>
    </div>
  `;
}

function waitForMapsReady(resolve, reject, timeoutMs = 10000) {
  const start = Date.now();
  const timer = setInterval(() => {
    if (window.google?.maps?.places) {
      clearInterval(timer);
      resolve();
      return;
    }

    if (Date.now() - start > timeoutMs) {
      clearInterval(timer);
      reject(new Error("Google Maps loaded too slowly or failed to initialize places library"));
    }
  }, 100);
}

function loadMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) {
      waitForMapsReady(resolve, reject);
      existingScript.addEventListener("load", () => waitForMapsReady(resolve, reject));
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.onload = () => waitForMapsReady(resolve, reject);
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

export default function LawyerMap({ keyword, refreshKey = 0 }) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [error, setError] = useState("");
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);

  const getPlaceDisplayName = (place) => {
    const fromDisplay = place?.displayName?.text || (typeof place?.displayName === "string" ? place.displayName : "");
    if (fromDisplay) return fromDisplay;

    if (place?.name && !String(place.name).startsWith("places/")) return place.name;

    if (place?.formattedAddress) return `Advisor near ${place.formattedAddress.split(",")[0]}`;

    return "Legal Advisor";
  };

  useEffect(() => {
    window.gm_authFailure = () => {
      setError(
        "Google Maps authentication failed. Check that Maps JavaScript API and Places API are enabled, billing is active, and http://localhost:3001 is allowed in API key referrers."
      );
    };

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps API key is missing. Add REACT_APP_GOOGLE_MAPS_API_KEY to .env.");
      return;
    }

    let isMounted = true;
    loadMapsScript(apiKey)
      .then(() => {
        if (!isMounted) return;
        setScriptLoaded(true);
      })
      .catch((scriptError) => {
        if (!isMounted) return;
        setError(scriptError.message || "Failed to initialize map");
      });

    return () => {
      isMounted = false;
      if (window.gm_authFailure) {
        delete window.gm_authFailure;
      }
    };
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !mapElementRef.current || mapRef.current || !window.google?.maps) {
      return;
    }

    mapRef.current = new window.google.maps.Map(mapElementRef.current, {
      center: defaultCenter,
      zoom: 4,
      streetViewControl: false,
      mapTypeControl: false,
    });

    infoWindowRef.current = new window.google.maps.InfoWindow();
    setIsReady(true);
  }, [scriptLoaded]);

  useEffect(() => {
    if (!isReady || !navigator.geolocation || !mapRef.current) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(loc);
        mapRef.current.panTo(loc);
        mapRef.current.setZoom(12);
      },
      () => {}
    );
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !mapRef.current || !window.google?.maps?.places) return;

    const runSearch = async () => {
      try {
        const { Place, SearchNearbyRankPreference } = await window.google.maps.importLibrary("places");
        const center = userLocation || mapRef.current.getCenter();
        const textQuery = `${keyword || "legal aid clinic"} lawyer legal clinic`.trim();

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        let places = [];

        if (typeof Place.searchByText === "function") {
          const textResult = await Place.searchByText({
            textQuery,
            fields: ["displayName", "location", "formattedAddress", "rating"],
            maxResultCount: 20,
            locationBias: {
              center,
              radius: 30000,
            },
          });
          places = textResult?.places || [];
        }

        if (places.length === 0 && typeof Place.searchNearby === "function") {
          const nearbyResult = await Place.searchNearby({
            fields: ["displayName", "location", "formattedAddress", "rating"],
            locationRestriction: {
              center,
              radius: 30000,
            },
            includedTypes: ["lawyer"],
            maxResultCount: 20,
            rankPreference: SearchNearbyRankPreference?.POPULARITY,
          });
          places = nearbyResult?.places || [];
        }

        const enrichNamePromises = places.map(async (place) => {
          if (place?.displayName?.text || typeof place?.displayName === "string") {
            return place;
          }

          if (typeof place?.fetchFields === "function") {
            try {
              await place.fetchFields({
                fields: ["displayName", "formattedAddress"],
              });
            } catch {
              // Keep graceful fallback name if fetchFields fails
            }
          }

          return place;
        });

        await Promise.all(enrichNamePromises);

        const sortedPlaces = [...places].sort((a, b) => ((b.rating || 0) - (a.rating || 0)));
        sortedPlaces.forEach((place) => {
          if (!place.location) return;

          const advisorName = getPlaceDisplayName(place);

          const marker = new window.google.maps.Marker({
            map: mapRef.current,
            position: place.location,
            title: advisorName,
          });

          marker.addListener("click", () => {
            infoWindowRef.current?.setContent("<div style='padding:4px 0;'>Loading advisor details...</div>");
            infoWindowRef.current?.open(mapRef.current, marker);

            const showDetails = async () => {
              try {
                if (typeof place.fetchFields === "function") {
                  await place.fetchFields({
                    fields: [
                      "displayName",
                      "formattedAddress",
                      "location",
                      "rating",
                      "userRatingCount",
                      "photos",
                      "nationalPhoneNumber",
                      "websiteURI",
                      "googleMapsURI",
                      "regularOpeningHours",
                      "businessStatus",
                    ],
                  });
                }
                infoWindowRef.current?.setContent(buildInfoContent(place));
              } catch {
                infoWindowRef.current?.setContent(buildInfoContent(place));
              }
            };

            showDetails();
          });

          markersRef.current.push(marker);
        });
      } catch (searchError) {
        setError(searchError?.message || "Failed to search nearby legal advisors.");
      }
    };

    runSearch();
  }, [isReady, keyword, refreshKey, userLocation]);

  if (error) {
    return (
      <div style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 8,
        border: "1px solid #d1a679",
        background: "#fff6ec",
        color: "#5c3b20",
        lineHeight: 1.5,
      }}>
        <strong>Map setup issue:</strong> {error}
      </div>
    );
  }
  return (
    <div>
      <div className="lawyer-map" ref={mapElementRef} style={mapContainerStyle} />
      {!isReady && <div style={{ marginTop: 10 }}>Loading map…</div>}
    </div>
  );
}