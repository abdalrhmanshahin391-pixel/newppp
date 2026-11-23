/** Only explicit successful sign-ins emit this; hydration/focus/refresh never do. */
export const ACTUAL_SIGNIN_EVENT = "uzyra:actual-signin";
export function notifyActualSignIn() {
  window.dispatchEvent(new Event(ACTUAL_SIGNIN_EVENT));
}