// Firebase settings for Google login, cloud save and the leaderboard.
//
// How to fill this in (see README "Google login setup"):
// Firebase console > Project settings (gear icon) > Your apps > Web app > SDK setup and configuration > Config.
// Copy the 4 values below from that config.
//
// These values are NOT secret. Every web app sends them to the browser.
// The data is protected by the rules in firestore.rules.
//
// While apiKey starts with "PASTE", login is off and the game runs in guest mode.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB_kgAM0nMb0-asfymEwXdUM0OYvOAK2NQ',
  authDomain: 'pixel-roguelike-web-game.firebaseapp.com',
  projectId: 'pixel-roguelike-web-game',
  appId: '1:1083071314615:web:10604609bf502fde646b32',
};
