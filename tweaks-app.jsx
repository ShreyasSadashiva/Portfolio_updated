// tweaks-app.jsx — React island that drives the Tweaks panel.
// Main page is vanilla; this only sets attributes / CSS vars on <html> and
// persists via the host (useTweaks rewrites the EDITMODE block below).

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "#3fe0c4",
  "font": "Space Grotesk",
  "density": "regular"
}/*EDITMODE-END*/;

// representative swatches → oklch hue used by --accent-h
const ACCENTS = [
  { hex: "#3fe0c4", hue: 175 }, // teal (default)
  { hex: "#6fb4ff", hue: 245 }, // sky
  { hex: "#b794ff", hue: 292 }, // violet
  { hex: "#a6e85a", hue: 130 }, // lime
  { hex: "#ff8c6b", hue: 28 }   // coral
];
const hueFor = (hex) => (ACCENTS.find((a) => a.hex.toLowerCase() === String(hex).toLowerCase()) || ACCENTS[0]).hue;

function TweaksApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const root = document.documentElement;

  // On mount, prefer the theme the user last chose via the nav toggle.
  React.useEffect(() => {
    let stored;
    try { stored = localStorage.getItem("sa_theme"); } catch (e) {}
    if (stored && stored !== t.theme) setTweak("theme", stored);
    // keep panel in sync if the nav toggle flips the theme later
    const onTheme = (e) => setTweak("theme", e.detail);
    window.addEventListener("sa-theme", onTheme);
    return () => window.removeEventListener("sa-theme", onTheme);
    // eslint-disable-next-line
  }, []);

  // Apply every tweak to the document.
  React.useEffect(() => {
    if (window.__applyTheme && root.getAttribute("data-theme") !== t.theme) {
      window.__applyTheme(t.theme);
    } else {
      root.setAttribute("data-theme", t.theme);
    }
  }, [t.theme]);

  React.useEffect(() => { root.style.setProperty("--accent-h", hueFor(t.accent)); }, [t.accent]);
  React.useEffect(() => {
    root.style.setProperty("--font-sans", `"${t.font}", system-ui, sans-serif`);
  }, [t.font]);
  React.useEffect(() => { root.setAttribute("data-density", t.density); }, [t.density]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Appearance" />
      <TweakRadio label="Theme" value={t.theme} options={["dark", "light"]}
                  onChange={(v) => setTweak("theme", v)} />
      <TweakColor label="Accent" value={t.accent} options={ACCENTS.map((a) => a.hex)}
                  onChange={(v) => setTweak("accent", v)} />

      <TweakSection label="Typography" />
      <TweakRadio label="Display font" value={t.font} options={["Space Grotesk", "Manrope"]}
                  onChange={(v) => setTweak("font", v)} />

      <TweakSection label="Layout" />
      <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]}
                  onChange={(v) => setTweak("density", v)} />
    </TweaksPanel>
  );
}

const __tweakMount = document.createElement("div");
__tweakMount.setAttribute("data-omelette-chrome", "");
document.body.appendChild(__tweakMount);
ReactDOM.createRoot(__tweakMount).render(<TweaksApp />);
