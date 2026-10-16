import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadBrand } from "@remotion/google-fonts/Fraunces";

export const serif = loadSerif("normal", { weights: ["400"] }).fontFamily;
loadSerif("italic", { weights: ["400"] });
export const sans = loadSans("normal", { weights: ["400", "500", "600", "700"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"] }).fontFamily;
export const brand = loadBrand("normal", { weights: ["700"] }).fontFamily;

/** Scalehouse brand palette (from the app's globals.css). */
export const C = {
  paper: "#fffef2",
  paper2: "#f6f5e8",
  sheet: "#ffffff",
  rule: "#e4e1cf",
  ink: "#1b1b18",
  ink2: "#333333",
  muted: "#7c7f88",
  forest: "#0f4a28",
  forest2: "#155c33",
  deep: "#0a2416",
  night: "#0c1410",
  gold: "#e8ae45",
  goldDeep: "#c98f2a",
  red: "#ca432f",
  green: "#3fa66a",
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;
