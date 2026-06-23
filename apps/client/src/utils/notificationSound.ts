export function playNotificationSound() {
  try {
    const audio = new Audio("/sounds/notification.mp3");
    audio.volume = 0.75;
    audio.currentTime = 0;

    void audio.play().catch(() => {
      // Browser may block audio before user interaction. Fail silently.
    });
  } catch {
    // Sound playback should never interrupt notification UI.
  }
}
