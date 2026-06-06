const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const API_UNAVAILABLE_MESSAGE =
  "Cannot reach the server. Please try again later.";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw { message: API_UNAVAILABLE_MESSAGE, field: "network" };
  }
}

export async function parseJson<T>(res: Response): Promise<T> {
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    throw { message: "Unexpected server response.", field: "network" };
  }
  if (!res.ok) {
    throw data;
  }
  return data;
}
