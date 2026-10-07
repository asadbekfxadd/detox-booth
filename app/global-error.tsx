"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f3ea", margin: 0, minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div role="alert" style={{ background: "#fff", borderRadius: 24, padding: 40, maxWidth: 360, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Сервис временно недоступен</h1>
          <p style={{ color: "#555", fontSize: 14 }}>Попробуйте обновить страницу через минуту.</p>
          <button onClick={() => retry()} style={{ background: "#15803d", color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 600, cursor: "pointer" }}>Повторить</button>
        </div>
      </body>
    </html>
  );
}
