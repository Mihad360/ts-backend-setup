import admin from "firebase-admin";
// import serviceAccount from "../../../../config";

if (!admin.apps.length) {
  admin.initializeApp({});
}

export default admin;
