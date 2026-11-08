// 1) Replace the placeholder Firebase settings below with your own Firebase web-app config.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const googleProvider = new GoogleAuthProvider();

const $ = (id) => document.getElementById(id);
const status = (message) => { $("statusMessage").textContent = message; };
const friendlyError = (error) => {
  const messages = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/email-already-in-use": "An account already exists with this email. Try signing in.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled."
  };
  return messages[error.code] || error.message || "Something went wrong. Please try again.";
};

async function saveUserProfile(user, extra = {}) {
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);
  const displayName = user.displayName || user.email?.split("@")[0] || "Player";
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email || "",
    displayName,
    photoURL: user.photoURL || "",
    updatedAt: serverTimestamp(),
    ...(existing.exists() ? {} : { createdAt: serverTimestamp(), invited: false }),
    ...extra
  }, { merge: true });
}

$("getStarted").addEventListener("click", () => $("account").scrollIntoView({ behavior: "smooth" }));
$("navAccount").addEventListener("click", () => $("account").scrollIntoView({ behavior: "smooth" }));

$("googleSignIn").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(result.user);
    status("Google sign-in successful. Welcome!");
  } catch (error) { status(friendlyError(error)); }
});

$("emailRegister").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return status("Enter your email and password first.");
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await saveUserProfile(result.user);
    status("Account created successfully!");
  } catch (error) { status(friendlyError(error)); }
});

$("emailSignIn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return status("Enter your email and password first.");
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await saveUserProfile(result.user);
    status("You are signed in.");
  } catch (error) { status(friendlyError(error)); }
});

$("saveProfile").addEventListener("click", async () => {
  const user = auth.currentUser;
  const displayName = $("displayName").value.trim();
  if (!user) return status("Please sign in first.");
  if (!displayName) return status("Enter a display name.");
  try {
    await updateProfile(user, { displayName });
    await saveUserProfile(user, { displayName });
    $("profileName").textContent = displayName;
    $("welcomeName").textContent = `Welcome, ${displayName}!`;
    $("avatar").textContent = displayName.charAt(0).toUpperCase();
    status("Profile saved.");
  } catch (error) { status(friendlyError(error)); }
});

$("redeemCode").addEventListener("click", async () => {
  const code = $("inviteCode").value.trim();
  if (!auth.currentUser) return status("Sign in before redeeming an invitation code.");
  if (!code) return status("Enter your RG invitation code.");
  try {
    // The code is checked by a trusted Cloud Function, never in browser JavaScript.
    const redeemInvitation = httpsCallable(functions, "redeemInvitationCode");
    const result = await redeemInvitation({ code });
    $("inviteStatus").textContent = result.data.message || "Invitation code accepted.";
    status("Invitation code redeemed successfully.");
  } catch (error) {
    status(error.message || "Could not redeem the code. Check it and try again.");
  }
});

$("signOut").addEventListener("click", async () => {
  try { await signOut(auth); status("You have signed out."); }
  catch (error) { status(friendlyError(error)); }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("authPanel").style.display = "block";
    $("dashboardPanel").style.display = "none";
    return;
  }
  try {
    await saveUserProfile(user);
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};
    const name = data.displayName || user.displayName || "Player";
    $("authPanel").style.display = "none";
    $("dashboardPanel").style.display = "block";
    $("welcomeName").textContent = `Welcome, ${name}!`;
    $("userEmail").textContent = user.email || "Google account";
    $("profileName").textContent = name;
    $("displayName").value = name;
    $("avatar").textContent = name.charAt(0).toUpperCase();
    $("inviteStatus").textContent = data.invited ? "RG invitation verified." : "No code redeemed yet.";
  } catch (error) { status(friendlyError(error)); }
});
