// Save and load for Solara City (localStorage, no network).
// Stores money, mission progress, wanted level and the player's spot
// so a session can resume exactly where it stopped.
const SAVE_KEY = 'solara-city-save-v3';

export function saveGame(state) {
  try {
    const data = {
      money: Math.floor(state.money),
      missionIndex: state.missions.index,
      missionStage: state.missions.stage,
      wanted: state.wanted.level,
      health: state.player.health,
      armor: state.player.armor,
      playerX: state.player.position.x,
      playerZ: state.player.position.z,
      clockMinutes: state.clockMinutes,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* storage unavailable */ }
}
