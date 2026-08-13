import type { SacoAxiosDualTokenOptions, SacoAxiosInstance } from "./types"

/** 使用双token验证 */
export const useDualToken = (options: SacoAxiosDualTokenOptions, instance: SacoAxiosInstance) => {
    /** 解构配置 */
    const { dualMode, accessToken, refreshToken, refreshTokenApi, refreshTokenHandler } = options

    let refreshPromise: Promise<string>

    return refreshPromise
}