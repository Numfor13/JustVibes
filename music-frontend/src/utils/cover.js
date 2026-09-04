// Backend has no album art, so each song gets a deterministic gradient
// derived from its songId — stable across reloads, and drawn only from
// the palette's wine/plum family so it never fights the UI around it.
const ANGLE_STEPS = [115, 135, 155, 160, 140];
const HUE_SHIFTS = [0, -8, 10, -14, 6];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function gradientFor(songId) {
  const h = hashString(songId || "seed");
  const angle = ANGLE_STEPS[h % ANGLE_STEPS.length];
  const hueShift = HUE_SHIFTS[Math.floor(h / 7) % HUE_SHIFTS.length];

  return {
    background: `linear-gradient(${angle}deg, hsl(${340 + hueShift} 45% 22%) 0%, hsl(${280 + hueShift} 30% 16%) 100%)`,
  };
}

export function coverStyle(songOrId) {
  const isSong = typeof songOrId === "object" && songOrId !== null;
  const songId = isSong ? songOrId.songId : songOrId;
  const coverUrl = isSong ? songOrId.coverUrl : undefined;

  if (coverUrl) {
    return {
      backgroundImage: `url(${coverUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  return gradientFor(songId);
}
