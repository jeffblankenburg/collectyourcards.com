/**
 * useHaptic - Hook for providing haptic feedback on mobile devices
 *
 * Uses the Vibration API where available for tactile feedback.
 * Provides different patterns for different types of interactions.
 */

export function useHaptic() {
  // Check if vibration is supported
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

  /**
   * Light haptic feedback - for selections, toggles
   */
  const light = () => {
    if (isSupported) {
      navigator.vibrate(10)
    }
  }

  /**
   * Medium haptic feedback - for confirmations, successful actions
   */
  const medium = () => {
    if (isSupported) {
      navigator.vibrate(25)
    }
  }

  /**
   * Heavy haptic feedback - for errors, warnings, important actions
   */
  const heavy = () => {
    if (isSupported) {
      navigator.vibrate(50)
    }
  }

  /**
   * Success pattern - double tap for positive feedback
   */
  const success = () => {
    if (isSupported) {
      navigator.vibrate([15, 50, 15])
    }
  }

  /**
   * Error pattern - longer vibration for errors
   */
  const error = () => {
    if (isSupported) {
      navigator.vibrate([50, 30, 50])
    }
  }

  /**
   * Selection changed - very light tap
   */
  const selection = () => {
    if (isSupported) {
      navigator.vibrate(5)
    }
  }

  /**
   * Impact feedback - for pull-to-refresh threshold reached
   */
  const impact = () => {
    if (isSupported) {
      navigator.vibrate(30)
    }
  }

  return {
    isSupported,
    light,
    medium,
    heavy,
    success,
    error,
    selection,
    impact
  }
}

export default useHaptic
