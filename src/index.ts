import axios, { isCancel } from 'axios'
import type { 
    SacoAxiosCreateOptions, 
    SacoAxiosDualTokenOptions, 
    SacoAxiosInstance 
} from './types'
import { useDualToken } from './utils'

/** 创建axios实例 */
export const createAxios = (options: SacoAxiosCreateOptions) => {
    /** 创建实例 */
    const instance = axios.create(options) as SacoAxiosInstance
    /** 使用双token Hook */
    const dualTokenHook = useDualToken(options as SacoAxiosDualTokenOptions, instance)
    
    /** 请求拦截 */
    instance.interceptors.request.use(config => {

        return config
    }, error => {

        return Promise.reject(error)
    })
    /** 响应拦截 */
    instance.interceptors.response.use(response => {
        return new Promise((resolve, reject) => {


            resolve(response)
        })
    }, error => {

        return Promise.reject(error)
    })
    return instance
}

export default createAxios