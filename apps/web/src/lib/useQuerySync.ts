import { useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'

export function useQuerySync(params: Record<string, any>) {
    const [sp, setSp] = useSearchParams()
    useEffect(() => {
        const next = new URLSearchParams(sp.toString())
        let changed = false
        for (const [k, v] of Object.entries(params)) {
            const val = v === undefined || v === null || v === '' ? null : String(v)
            if (val === null) {
                if (next.has(k)) { next.delete(k); changed = true }
            } else if (next.get(k) !== val) { next.set(k, val); changed = true }
        }
        if (changed) setSp(next, { replace: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, Object.values(params))
}
