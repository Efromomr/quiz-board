const PLAYER_ID_KEY = "dnd-player-id";

/**
 * Gets or creates a persistent player ID stored in localStorage.
 * This ID persists across page refreshes and browser sessions.
 */
export function getPlayerId(): string {
  let playerId = localStorage.getItem(PLAYER_ID_KEY);
  
  if (!playerId) {
    // Generate a unique ID using timestamp and random number
    playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  
  return playerId;
}
