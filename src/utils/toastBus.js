// Mini pub/sub untuk toast in-window tanpapust library. Dipakai notifyExportSuccess
// untuk menampilkan umpan balik export yang PASTI terlihat (tidak bergantung pada
// toast OS/native yang butuh AUMID terdaftar di Start Menu).
// kind: 'success' | 'error' | 'info' (default 'success').
const listeners = new Set();

export function showToast(toast) {
  const payload = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: "Export berhasil",
    body: "",
    kind: "success",
    ...toast,
    createdAt: Date.now(),
  };
  listeners.forEach((fn) => fn(payload));
  return payload.id;
}

export function subscribeToToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}