/** Запускается один раз при старте сервера. Здесь поднимаем ночную проверку: закрыть кассу и прислать итоги в Telegram. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduler } = await import("@/services/daily-report");
  startScheduler();
}
