export function customStringify(v: any) {
    const cache = new Map();
    return JSON.stringify(v, (_, value) => {
        if (typeof value === "object" && value !== null) {
            if (cache.get(value)) {
            // Circular reference found, discard key
            return;
            }
            // Store value in our map
            cache.set(value, true);
        }
        return value;
    });
}

export function parseBoolean(str: string): boolean {
        return (str === "Yes");
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
