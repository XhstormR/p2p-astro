export function now(): number {
    return Date.now() + Math.random() + Math.random();
}

export function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min);
}

export function download(data: BlobPart, fileName: string, fileType?: string) {
    let blob = new Blob([data], { type: fileType || "application/octet-stream" });
    let url = URL.createObjectURL(blob);

    let link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 500);
}

export function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        let reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export function isValidUrl(str: string): boolean {
    try {
        const url = new URL(str);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

export async function dataUrlToBlob(dataUrl: string) {
    let response = await fetch(dataUrl);
    return await response.blob();
}

export function error(err: any): never {
    throw new Error(err);
}

export function copyOf<T>(old: T, partial?: Partial<T>): T {
    return { ...old, ...partial };
}

export function formatFileSize(bytes?: number): string {
    if (!bytes) return "0 Bytes";
    const sizeTier = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizeTier[i]}`;
}

/** 将时间戳格式化为本地时间字符串 */
export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
}

/** 复制文本到剪贴板，返回是否成功 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
