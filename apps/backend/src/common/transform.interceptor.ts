import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { map } from 'rxjs/operators'
import type { Observable } from 'rxjs'
import { Decimal } from '@prisma/client/runtime/library'

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return Object.prototype.toString.call(v) === '[object Object]'
}

function sanitize(value: any): any {
    if (value === null || value === undefined) return value
    if (typeof value === 'bigint') return value.toString()
    if (value instanceof Date) return value.toISOString()
    if (value instanceof Decimal) return value.toString()
    if (Array.isArray(value)) return value.map(sanitize)
    if (isPlainObject(value)) {
        const out: Record<string, any> = {}
        for (const [k, v] of Object.entries(value)) out[k] = sanitize(v)
        return out
    }
    return value
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(map((data) => sanitize(data)))
    }
}
