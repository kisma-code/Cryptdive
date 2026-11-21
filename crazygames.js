// CrazyGames build only (tools/build-crazygames.py puts this file in the zip).
// It starts the CrazyGames SDK, then loads the game. The web version does not use this file.
// - Saves: the CrazyGames Data module (synced to the player's CrazyGames account).
// - Ads: rewarded ad only (double Souls at game over), never during play.
// - No Google login, no leaderboard, no service worker.
(async () => {
  window.PD_PLATFORM = 'crazygames';
  document.documentElement.classList.add('platform-crazygames');
  const sdk = window.CrazyGames && window.CrazyGames.SDK;
  let ready = false;

  if (sdk) {
    try {
      // Do not wait forever (for example, when an ad blocker blocks the SDK).
      await Promise.race([sdk.init(), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 6000))]);
      ready = sdk.environment !== 'disabled';
    } catch (e) { ready = false; }
  }
  const safe = (fn) => { try { if (ready) fn(); } catch (e) { /* ignore */ } };
  safe(() => sdk.game.loadingStart());

  // Storage: the Data module if it works, else the browser storage.
  let storage = window.localStorage;
  if (ready && sdk.data) {
    try { sdk.data.getItem('pixelDepths.test'); storage = sdk.data; } catch (e) { /* Data module is off */ }
  }

  window.PD_CG = {
    storage,
    adsReady: ready,
    gameplayStart: () => safe(() => sdk.game.gameplayStart()),
    gameplayStop: () => safe(() => sdk.game.gameplayStop()),
    // done(true) only when the player watched the whole ad.
    rewardedAd({ start, done }) {
      if (!ready) { done(false); return; }
      let ended = false;
      const end = (ok) => { if (!ended) { ended = true; done(ok); } };
      try {
        sdk.ad.requestAd('rewarded', {
          adStarted: () => start(),
          adFinished: () => end(true),
          adError: () => end(false),
        });
      } catch (e) { end(false); }
    },
  };

  // Load the game now that the storage is ready.
  const s = document.createElement('script');
  s.src = 'game.js';
  s.onload = () => safe(() => sdk.game.loadingStop());
  document.body.appendChild(s);
})();
