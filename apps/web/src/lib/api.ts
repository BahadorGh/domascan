export const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000'

type QueryParams = Record<string, string | number | boolean | undefined | null>

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(path.replace(/^\//, ''), API_BASE + '/')
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null) continue
            url.searchParams.set(k, String(v))
        }
    }
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
    return res.json()
}
