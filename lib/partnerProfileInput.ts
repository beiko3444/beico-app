export function parsePartnerProfileInput(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID')
    const input = body as Record<string, unknown>
    const limits = { name: 100, contact: 60, email: 254, fax: 60, address: 500 }
    if (Object.keys(input).some(key => !(key in limits))) throw new Error('INVALID')
    const result = {} as Record<keyof typeof limits, string>
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
        const value = input[key]
        if (typeof value !== 'string' || value.trim().length > limits[key]) throw new Error('INVALID')
        result[key] = value.trim()
    }
    if (!result.name || (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))) throw new Error('INVALID')
    return result
}
