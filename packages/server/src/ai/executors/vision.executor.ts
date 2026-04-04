import type { ToolResult } from '../executor.js';
import { chatWithImage } from '../ai.service.js';

type Args = Record<string, unknown>;

// ── vision_identify_media ────────────────────────────────────────────────────

export async function handleVisionIdentifyMedia(args: Args): Promise<ToolResult> {
  const image = typeof args.image === 'string' ? args.image : undefined;
  if (!image) {
    return { success: false, error: 'Kein Bild übermittelt. Bitte ein Bild im Chat hochladen.' };
  }

  const prompt = `Analysiere dieses Bild und identifiziere den Film, die Serie oder das Medium das dargestellt wird.
Gib folgende Informationen zurück falls erkennbar:
- Titel des Films/der Serie
- Erscheinungsjahr
- Genre
- Wichtige Schauspieler die du erkennst
- Kurze Beschreibung der Szene

Antworte auf Deutsch in einem strukturierten Format.`;

  const response = await chatWithImage(prompt, image);
  return { success: true, data: { analysis: response } };
}

// ── vision_analyze_poster ────────────────────────────────────────────────────

export async function handleVisionAnalyzePoster(args: Args): Promise<ToolResult> {
  const image = typeof args.image === 'string' ? args.image : undefined;
  if (!image) {
    return { success: false, error: 'Kein Bild übermittelt. Bitte ein Poster-Bild im Chat hochladen.' };
  }

  const prompt = `Analysiere dieses Film- oder Serien-Poster im Detail.
Beschreibe:
- Welcher Film/welche Serie ist das?
- Welches Designkonzept wird verwendet?
- Farbpalette und Stimmung
- Sichtbare Schauspieler oder Charaktere
- Textinhalte (Titel, Taglines, Credits)
- Qualität und Stil des Posters

Antworte auf Deutsch.`;

  const response = await chatWithImage(prompt, image);
  return { success: true, data: { analysis: response } };
}

// ── vision_ui_help ───────────────────────────────────────────────────────────

export async function handleVisionUiHelp(args: Args): Promise<ToolResult> {
  const image = typeof args.image === 'string' ? args.image : undefined;
  const question = typeof args.question === 'string' ? args.question : 'Was sehe ich hier?';

  if (!image) {
    return { success: false, error: 'Kein Screenshot übermittelt. Bitte einen Screenshot im Chat hochladen.' };
  }

  const prompt = `Der User hat einen Screenshot von der nexarr Media-Management App gemacht und braucht Hilfe.
Frage des Users: "${question}"

Analysiere den Screenshot und beantworte die Frage. Beschreibe was du siehst und gib hilfreiche Anweisungen.
nexarr ist eine App zum Verwalten von Filmen, Serien, Musik und Downloads mit Diensten wie Radarr, Sonarr, Plex, Tautulli etc.

Antworte auf Deutsch.`;

  const response = await chatWithImage(prompt, image);
  return { success: true, data: { analysis: response } };
}
