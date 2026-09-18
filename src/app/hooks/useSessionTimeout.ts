import { useState, useEffect, useRef, useCallback } from 'react';

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes idle before warning
const WARNING_MS = 2 * 60 * 1000;     // 2 minutes to respond before auto-logout
const WARNING_SECONDS = WARNING_MS / 1000;

export function useSessionTimeout(onTimeout: () => void, enabled = false) {
  const [warningActive, setWarningActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

  // Stable ref so onTimeout changes never invalidate the timers
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdownInterval = useRef<ReturnType<typeof setInterval>>();
  const warningRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(logoutTimer.current);
    clearInterval(countdownInterval.current);
  }, []);

  // Stable — no deps that change during a session
  const startInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      warningRef.current = true;
      setWarningActive(true);
      setSecondsLeft(WARNING_SECONDS);

      countdownInterval.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(countdownInterval.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);

      logoutTimer.current = setTimeout(() => {
        warningRef.current = false;
        setWarningActive(false);
        onTimeoutRef.current();
      }, WARNING_MS);
    }, INACTIVITY_MS);
  }, []); // intentionally empty — uses refs for everything mutable

  const extendSession = useCallback(() => {
    clearAllTimers();
    warningRef.current = false;
    setWarningActive(false);
    setSecondsLeft(WARNING_SECONDS);
    startInactivityTimer();
  }, [clearAllTimers, startInactivityTimer]);

  useEffect(() => {
    if (!enabled) {
      // Reset warning state if session ends while dialog is open
      clearAllTimers();
      warningRef.current = false;
      setWarningActive(false);
      setSecondsLeft(WARNING_SECONDS);
      return;
    }

    const handleActivity = () => {
      if (!warningRef.current) startInactivityTimer();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    startInactivityTimer();

    return () => {
      clearAllTimers();
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [enabled, startInactivityTimer, clearAllTimers]); // startInactivityTimer is now stable

  return { warningActive, secondsLeft, extendSession };
}
