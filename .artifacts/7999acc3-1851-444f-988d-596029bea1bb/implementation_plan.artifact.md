# Implementation Plan - Final Fix for Firebase Initialization Error

This plan addresses the recurring `TypeError: Cannot read property 'auth' of undefined` and `undefined is not a function` errors by standardizing the React Native Firebase integration and removing the intermediate wrapper that seems to be causing module loading issues.

## Proposed Changes

### [Firebase Integration]

#### [MODIFY] [App.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/App.tsx)
- **Direct Imports:** Import `auth` and `firestore` directly from `@react-native-firebase/auth` and `@react-native-firebase/firestore`.
- **Remove Wrapper Dependency:** Stop importing `auth` and `firestore` from `./src/lib/firebase`. This removes the layer where `undefined` is being introduced.
- **Retain Utilities:** Keep importing custom utilities like `runInBatches` from `./src/lib/firebase`.

#### [MODIFY] [src/lib/firebase.ts](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/lib/firebase.ts)
- **Clean Exports:** Ensure it only exports the higher-level functions (`signIn`, `signUp`, `runInBatches`) and avoid re-exporting the raw Firebase modules which can cause conflicts with default/named exports.

#### [MODIFY] [src/screens/AuthScreen.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/screens/AuthScreen.tsx)
- Update imports to use the cleaned-up `./src/lib/firebase` and direct `@react-native-firebase` modules if necessary.

## Verification Plan

### Manual Verification
1. **App Launch:** Verify that the red error screen is gone and the app proceeds to "Syncing Profile" or "AuthScreen".
2. **Login Flow:** Test the login/signup functionality to ensure `auth()` instance is correctly created and used.
3. **Firestore Sync:** Ensure `firestore().batch()` and other calls work as expected.
