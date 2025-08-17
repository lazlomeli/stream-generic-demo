
export async function postJSON<T>(url: string, accessToken: string, body?: any): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${url} -> ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
  