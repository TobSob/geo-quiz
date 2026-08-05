/** Die vier Listen der Bestenliste — `cups` ist der Hauptpunkt, der Rest hängt darunter. */
export type LeaderboardTab = 'local' | 'global' | 'cups' | 'level'

/**
 * Welche Liste beim Öffnen der Bestenliste vorausgewählt ist.
 *
 * Der Geo Cup ist die Hauptdisziplin und damit der Regelfall. Gäste und Builds
 * ohne Backend würden dort aber nur den Account-Hinweis sehen — die starten
 * deshalb weiter bei „Meine Rekorde" (Nutzer-Entscheid 2026-08-04).
 *
 * Solange die Sitzung noch lädt (`connecting`), bleibt es beim Cup: registrierte
 * Spieler sehen so keinen Tab-Sprung, Gäste rutschen danach einmal auf ihre
 * lokalen Rekorde. Beim Öffnen aus dem Menü ist die Sitzung längst aufgelöst,
 * der Fall trifft praktisch nur einen Direktaufruf von `#/scores`.
 */
export function startTab(
  onlineEnabled: boolean,
  status: 'offline' | 'connecting' | 'online',
  isAnonymous: boolean,
): LeaderboardTab {
  if (!onlineEnabled) return 'local'
  if (status === 'connecting') return 'cups'
  return isAnonymous ? 'local' : 'cups'
}
