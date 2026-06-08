/**
 * firebase.js — Geminitor Pro Firebase module.
 * Uses Firebase compat SDK v10 (loaded via CDN script tags).
 * Provides Auth + Firestore functions for the entire app.
 */

// ── Firebase Config ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDp1qc2h0a0ZC66-L_IkPEF23XIbhNZW0s",
  authDomain:        "geminitor-5f1cd.firebaseapp.com",
  projectId:         "geminitor-5f1cd",
  storageBucket:     "geminitor-5f1cd.firebasestorage.app",
  messagingSenderId: "839260926369",
  appId:             "1:839260926369:web:4cfd31d521d46a770e5be0",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function loginWithEmail(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

async function signupWithEmail(name, email, password) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName: name });
  await db.collection("users").doc(cred.user.uid).set({
    name,
    email,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
    totalChats: 0,
  }, { merge: true });
  return cred.user;
}

async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const cred     = await auth.signInWithPopup(provider);
  const user     = cred.user;
  const ref      = db.collection("users").doc(user.uid);
  const snap     = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name:       user.displayName || "User",
      email:      user.email,
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      totalChats: 0,
    });
  }
  return user;
}

async function logout() {
  await auth.signOut();
}

function getCurrentUser() {
  return auth.currentUser;
}

function onAuthChange(callback) {
  return auth.onAuthStateChanged(callback);
}

async function sendPasswordReset(email) {
  await auth.sendPasswordResetEmail(email);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT HISTORY (FIRESTORE)
// ═══════════════════════════════════════════════════════════════════════════════

async function createNewChat(userId, persona, model) {
  const ref = await db
    .collection("users").doc(userId)
    .collection("chats").add({
      title:     "New Chat",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      persona:   persona || "General Intelligence Agent",
      model:     model   || "gemini-2.5-flash",
    });
  await db.collection("users").doc(userId).update({
    totalChats: firebase.firestore.FieldValue.increment(1),
  });
  return ref.id;
}

async function saveMessage(userId, chatId, message) {
  const chatRef = db.collection("users").doc(userId).collection("chats").doc(chatId);
  const msgRef  = chatRef.collection("messages").add({
    role:         message.role,
    content:      message.content,
    timestamp:    firebase.firestore.FieldValue.serverTimestamp(),
    responseTime: message.responseTime || null,
    tokens:       message.tokens || null,
  });
  const updates = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (message.role === "user") {
    const snap = await chatRef.collection("messages").limit(1).get();
    if (snap.empty) {
      updates.title = message.content.slice(0, 30) + (message.content.length > 30 ? "…" : "");
    }
  }
  await chatRef.update(updates);
  return msgRef;
}

async function loadChatHistory(userId) {
  const snap = await db
    .collection("users").doc(userId)
    .collection("chats")
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();
  return snap.docs.map(d => ({ chatId: d.id, ...d.data() }));
}

async function loadChatMessages(userId, chatId) {
  const snap = await db
    .collection("users").doc(userId)
    .collection("chats").doc(chatId)
    .collection("messages")
    .orderBy("timestamp", "asc")
    .get();
  return snap.docs.map(d => ({ msgId: d.id, ...d.data() }));
}

async function deleteChat(userId, chatId) {
  const messagesSnap = await db
    .collection("users").doc(userId)
    .collection("chats").doc(chatId)
    .collection("messages").get();
  const batch = db.batch();
  messagesSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection("users").doc(userId).collection("chats").doc(chatId));
  await batch.commit();
}

async function updateChatTitle(userId, chatId, title) {
  await db.collection("users").doc(userId).collection("chats").doc(chatId).update({ title });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS (FIRESTORE)
// ═══════════════════════════════════════════════════════════════════════════════

async function updateAnalytics(userId, responseTime, tokens, userMessage) {
  const ref = db.collection("users").doc(userId).collection("analytics").doc(userId);
  const words = (userMessage || "")
    .toLowerCase()
    .match(/\b[a-z]{4,}\b/g) || [];
  const stopWords = new Set([
    "what","this","that","with","from","have","been","will","your","about",
    "just","more","some","there","their","then","than","when","where","which",
    "into","also","very","much","does","only","over","such","make","like",
    "know","tell","give","help","want","need","please","okay","thanks","can",
    "could","would","should","write","show","explain",
  ]);
  const wordUpdates = {};
  words.filter(w => !stopWords.has(w)).forEach(w => {
    wordUpdates[`topWords.${w}`] = firebase.firestore.FieldValue.increment(1);
  });

  await ref.set({
    totalMessages:     firebase.firestore.FieldValue.increment(1),
    totalTokens:       firebase.firestore.FieldValue.increment(tokens || 0),
    totalResponseTime: firebase.firestore.FieldValue.increment(responseTime || 0),
    messageCount:      firebase.firestore.FieldValue.increment(1),
    lastUpdated:       firebase.firestore.FieldValue.serverTimestamp(),
    ...wordUpdates,
  }, { merge: true });
}

async function getAnalytics(userId) {
  const snap = await db
    .collection("users").doc(userId)
    .collection("analytics").doc(userId).get();
  if (!snap.exists) return null;
  return snap.data();
}
