(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };

  function isConfigured() {
    return Object.keys(firebaseConfig).every(function (key) {
      return String(firebaseConfig[key] || "").trim().length > 0;
    });
  }

  async function bootstrap() {
    if (!isConfigured()) {
      return {
        enabled: false,
        reason: "Firebase config not provided. Running in local-first demo mode."
      };
    }

    try {
      var appModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      var authModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      var firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

      var app = appModule.initializeApp(firebaseConfig);
      var auth = authModule.getAuth(app);
      var db = firestoreModule.getFirestore(app);

      try {
        await authModule.signInAnonymously(auth);
      } catch (authError) {
        console.warn("Anonymous Firebase sign-in skipped:", authError);
      }

      return {
        enabled: true,
        auth: auth,
        db: db,
        modules: firestoreModule
      };
    } catch (error) {
      console.warn("Firebase bootstrap failed. Falling back to local mode.", error);
      return {
        enabled: false,
        reason: error.message || "Unknown Firebase bootstrap error"
      };
    }
  }

  async function syncDocument(context, collectionName, documentId, payload) {
    if (!context || !context.enabled) {
      return false;
    }

    try {
      var documentReference = context.modules.doc(context.db, collectionName, documentId);
      await context.modules.setDoc(documentReference, payload, { merge: true });
      return true;
    } catch (error) {
      console.warn("Firebase sync failed:", error);
      return false;
    }
  }

  window.AERON_FIREBASE = {
    firebaseConfig: firebaseConfig,
    isConfigured: isConfigured,
    bootstrap: bootstrap,
    syncDocument: syncDocument
  };
}());
