// Google login (Firebase Auth), cloud save and leaderboard (Cloud Firestore).
// The game (game.js) talks to this file through window.PD_CLOUD.
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

const configured = !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('PASTE'));

let fb = null;          // loaded Firebase functions
let auth = null, db = null;

const cloud = {
  configured,
  required: configured, // when login is set up, players must sign in
  user: null,           // { uid, name }
  data: null,           // the player's cloud record
  showLogin,
  saveRun,
  saveBest,
  openBoard,
  signOut: doSignOut,
};
window.PD_CLOUD = cloud;

// Only the first name is shown to other players.
function publicName(u) {
  const n = (u.displayName || 'Player').trim().split(/\s+/)[0];
  return n.slice(0, 16) || 'Player';
}

function setLoginMsg(text, isError) {
  const el = $('loginMsg');
  el.textContent = text || '';
  el.classList.toggle('err', !!isError);
}

function showLogin() {
  if (!configured) return;
  show('scrLogin');
}

function updateAccountUi() {
  if (!configured) {
    hide('account');
    show('guestNote');
    hide('btnBoard');
    hide('btnOverBoard');
    return;
  }
  hide('guestNote');
  show('btnBoard');
  show('btnOverBoard');
  if (cloud.user) {
    $('accName').textContent = cloud.user.name;
    show('account');
  } else {
    hide('account');
  }
}

// ---------- In-app browsers ----------
// Apps like LINE, Instagram and Facebook open links in their own small browser.
// Google does not allow sign-in there, and the sign-in pop-up is blocked.
const UA = navigator.userAgent || '';
const IS_LINE = /\bLine\//i.test(UA);
const IN_APP = IS_LINE || /FBAN|FBAV|FB_IAB|FBIOS|Instagram|MicroMessenger|KAKAOTALK|musical_ly|TikTok|BytedanceWebview|Snapchat/i.test(UA);
const EXT_PARAM = 'openExternalBrowser';

function goExternal() {
  // LINE opens the page in the phone's normal browser (Safari) when the link has ?openExternalBrowser=1.
  const u = new URL(location.href);
  u.searchParams.set(EXT_PARAM, '1');
  location.replace(u.toString());
}
function showInAppNote() {
  show('inAppNote');
  // Only LINE supports the "open in the normal browser" link option.
  if (!IS_LINE) hide('btnOpenExternal');
  hide('btnGoogle');
  setLoginMsg('');
}
if (IS_LINE && !new URL(location.href).searchParams.has(EXT_PARAM)) {
  goExternal();
} else if (!IN_APP && new URL(location.href).searchParams.has(EXT_PARAM)) {
  // We are in the normal browser now: remove the extra part from the address.
  const u = new URL(location.href);
  u.searchParams.delete(EXT_PARAM);
  history.replaceState(null, '', u.pathname + u.search + u.hash);
}
$('btnCopyLink').addEventListener('click', async () => {
  const u = new URL(location.href);
  u.searchParams.delete(EXT_PARAM);
  const link = u.origin + u.pathname;
  try { await navigator.clipboard.writeText(link); $('btnCopyLink').textContent = 'LINK COPIED!'; }
  catch (e) { $('inAppLink').textContent = link; show('inAppLink'); }
});
$('btnOpenExternal').addEventListener('click', goExternal);

// ---------- Start ----------
updateAccountUi();
if (configured) init();

async function init() {
  show('scrLogin');
  $('btnGoogle').disabled = true;
  setLoginMsg('LOADING...');
  try {
    const [app, a, f] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);
    fb = { ...app, ...a, ...f };
    const firebaseApp = fb.initializeApp(FIREBASE_CONFIG);
    auth = fb.getAuth(firebaseApp);
    db = fb.getFirestore(firebaseApp);
    await fb.setPersistence(auth, fb.browserLocalPersistence);
    fb.onAuthStateChanged(auth, onUser);
    $('btnGoogle').disabled = false;
    setLoginMsg('');
    if (IN_APP) showInAppNote();
  } catch (e) {
    setLoginMsg('COULD NOT LOAD LOGIN. CHECK YOUR INTERNET, THEN TAP TO TRY AGAIN.', true);
    $('btnGoogle').disabled = false;
    $('btnGoogle').dataset.retry = '1';
  }
}

async function onUser(u) {
  if (!u) {
    cloud.user = null;
    cloud.data = null;
    updateAccountUi();
    show('scrLogin');
    return;
  }
  cloud.user = { uid: u.uid, name: publicName(u) };
  setLoginMsg('LOADING YOUR SAVE...');
  try {
    const snap = await fb.getDoc(fb.doc(db, 'players', u.uid));
    cloud.data = snap.exists() ? snap.data() : null;
  } catch (e) {
    cloud.data = null;
  }
  setLoginMsg('');
  // Merge: keep the higher best floor (device or cloud).
  const game = window.pdGame;
  if (game) {
    const cloudBest = (cloud.data && cloud.data.bestFloor) || 0;
    const localBest = game.getBest();
    if (cloudBest > localBest) game.setBest(cloudBest);
    if (cloud.data && cloud.data.weapon) game.setWeapon(cloud.data.weapon);
    if (localBest > cloudBest) saveBest(localBest);
  }
  updateAccountUi();
  hide('scrLogin');
}

$('btnGoogle').addEventListener('click', async () => {
  if ($('btnGoogle').dataset.retry) {
    delete $('btnGoogle').dataset.retry;
    init();
    return;
  }
  if (!auth) return;
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  setLoginMsg('');
  try {
    await fb.signInWithPopup(auth, provider);
  } catch (e) {
    const code = e && e.code;
    // We do not use the redirect method: it fails when the browser keeps
    // the sign-in data apart (Safari, and links opened from other apps).
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      if (IN_APP) showInAppNote();
      else setLoginMsg('THE SIGN-IN WINDOW WAS BLOCKED. ALLOW POP-UPS FOR THIS SITE, THEN TRY AGAIN.', true);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      setLoginMsg(errText(e), true);
    }
  }
});

function errText(e) {
  const code = (e && e.code) || '';
  if (code === 'auth/unauthorized-domain') return 'THIS WEBSITE IS NOT ALLOWED IN FIREBASE YET (AUTHORIZED DOMAINS).';
  if (code === 'auth/network-request-failed') return 'NO INTERNET. TRY AGAIN.';
  if (code === 'auth/operation-not-allowed') return 'GOOGLE LOGIN IS NOT TURNED ON IN FIREBASE.';
  return 'LOGIN FAILED. TRY AGAIN.';
}

async function doSignOut() {
  if (auth) await fb.signOut(auth);
}

// ---------- Cloud save ----------
// Called at the end of each run (game over or quit).
async function saveRun(run) {
  if (!cloud.user || !db) return 'off';
  const d = cloud.data || {};
  const next = {
    name: cloud.user.name,
    bestFloor: Math.max(d.bestFloor || 0, run.floor | 0),
    bestLevel: Math.max(d.bestLevel || 0, run.level | 0),
    bestKills: Math.max(d.bestKills || 0, run.kills | 0),
    weapon: String(run.weapon || ''),
    runs: (d.runs || 0) + 1,
  };
  try {
    await fb.setDoc(fb.doc(db, 'players', cloud.user.uid), { ...next, updatedAt: fb.serverTimestamp() }, { merge: true });
    cloud.data = { ...d, ...next };
    return 'ok';
  } catch (e) {
    return 'fail';
  }
}

// Called when the player reaches a new best floor during a run.
let bestTimer = null;
function saveBest(floor) {
  if (!cloud.user || !db) return;
  const d = cloud.data || {};
  if ((d.bestFloor || 0) >= floor) return;
  clearTimeout(bestTimer);
  bestTimer = setTimeout(async () => {
    const next = { name: cloud.user.name, bestFloor: floor, bestLevel: d.bestLevel || 0, bestKills: d.bestKills || 0, weapon: d.weapon || '', runs: d.runs || 0 };
    try {
      await fb.setDoc(fb.doc(db, 'players', cloud.user.uid), { ...next, updatedAt: fb.serverTimestamp() }, { merge: true });
      cloud.data = { ...d, ...next };
    } catch (e) { /* the run save at the end tries again */ }
  }, 500);
}

// ---------- Leaderboard ----------
async function openBoard() {
  const list = $('boardList');
  list.innerHTML = '';
  $('boardMsg').textContent = 'LOADING...';
  show('scrBoard');
  if (!db) { $('boardMsg').textContent = 'SIGN IN TO SEE THE LEADERBOARD.'; return; }
  try {
    const q = fb.query(fb.collection(db, 'players'), fb.orderBy('bestFloor', 'desc'), fb.limit(20));
    const snap = await fb.getDocs(q);
    $('boardMsg').textContent = snap.empty ? 'NO SCORES YET. BE THE FIRST!' : '';
    let rank = 0;
    snap.forEach((docSnap) => {
      rank++;
      const v = docSnap.data();
      const li = document.createElement('li');
      if (cloud.user && docSnap.id === cloud.user.uid) li.classList.add('me');
      const r = document.createElement('span'); r.className = 'rank'; r.textContent = rank;
      const n = document.createElement('span'); n.className = 'name'; n.textContent = v.name || 'Player';
      const f = document.createElement('span'); f.className = 'floor'; f.textContent = 'F' + (v.bestFloor || 0);
      li.append(r, n, f);
      list.appendChild(li);
    });
  } catch (e) {
    $('boardMsg').textContent = 'COULD NOT LOAD THE LEADERBOARD.';
  }
}

$('btnBoard').addEventListener('click', openBoard);
$('btnOverBoard').addEventListener('click', openBoard);
$('btnBoardClose').addEventListener('click', () => hide('scrBoard'));
$('btnSignOut').addEventListener('click', doSignOut);
