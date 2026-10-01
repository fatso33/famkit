/** A light tap of the phone's vibration motor, where it has one (Android; iPhones have none). */
export function tick(ms = 8) {
  navigator.vibrate?.(ms);
}
