import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios"
import type { ApiResponse, ValidationError } from "@/types/api.types"
import { tokenStorage } from "@/lib/storage"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000"

export class ApiError extends Error {
  statusCode: number
  errors: ValidationError[]
  constructor(message: string, statusCode = 0, errors: ValidationError[] = []) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.errors = errors
  }
}

export interface CallOptions {
  timeoutMs?: number
}

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 25_000,
  headers: {
    "Content-Type": "application/json",
  },
})

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshTokens(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh()
  if (!refreshToken) {
    tokenStorage.clear()
    return null
  }
  try {
    const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${BASE_URL}/api/v1/auth/refresh`,
      { refreshToken },
      { timeout: 15_000 }
    )
    if (res.data?.success && res.data.data) {
      tokenStorage.set(res.data.data.accessToken, res.data.data.refreshToken)
      return res.data.data.accessToken
    }
    tokenStorage.clear()
    return null
  } catch {
    tokenStorage.clear()
    return null
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const url = original?.url ?? ""
    const isExcluded = url.includes("/auth/") || url.includes("/api/v1/public/")

    if (error.response?.status === 401 && original && !original._retry && !isExcluded) {
      original._retry = true
      if (!refreshPromise) {
        refreshPromise = refreshTokens().finally(() => {
          refreshPromise = null
        })
      }
      const newAccess = await refreshPromise
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`
        return client(original)
      }
    }
    return Promise.reject(error)
  }
)

function normalizeError<T>(err: unknown): ApiResponse<T> {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Partial<ApiResponse<T>> | undefined
    return {
      success: false,
      message: data?.message || err.message || "Network request failed",
      statusCode: data?.statusCode ?? err.response?.status ?? 0,
      data: null,
      errors: data?.errors ?? [],
    }
  }
  return {
    success: false,
    message: err instanceof Error ? err.message : "An unexpected error occurred",
    statusCode: 0,
    data: null,
    errors: [],
  }
}

function cleanParams(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!payload) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null && v !== "") {
      out[k] = v
    }
  }
  return out
}

export async function wrapCall<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  payload?: Record<string, unknown>,
  options: CallOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await client.request<ApiResponse<T>>({
      method,
      url: path,
      params: method === "GET" ? cleanParams(payload) : undefined,
      data: method !== "GET" ? payload : undefined,
      timeout: options.timeoutMs ?? 25_000,
    })
    return res.data
  } catch (err) {
    return normalizeError<T>(err)
  }
}

export async function uploadCall<T>(
  path: string,
  files: File[],
  field = "photos"
): Promise<ApiResponse<T>> {
  const form = new FormData()
  for (const file of files) {
    form.append(field, file)
  }
  try {
    const res = await client.post<ApiResponse<T>>(path, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000,
    })
    return res.data
  } catch (err) {
    return normalizeError<T>(err)
  }
}

export async function uploadWithFields<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
  fileField = "file"
): Promise<ApiResponse<T>> {
  const form = new FormData()
  form.append(fileField, file)
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== "") form.append(k, v)
  }
  try {
    const res = await client.post<ApiResponse<T>>(path, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000,
    })
    return res.data
  } catch (err) {
    return normalizeError<T>(err)
  }
}

export async function downloadFile(
  path: string,
  filename: string,
  params?: Record<string, unknown>
): Promise<void> {
  const res = await client.get(path, {
    params: cleanParams(params),
    responseType: "blob",
    timeout: 60_000,
  })
  const blob = new Blob([res.data], { type: String(res.headers["content-type"] || "application/octet-stream") })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function openPdfInNewTab(path: string, params?: Record<string, unknown>): Promise<void> {
  const res = await client.get(path, {
    params: cleanParams(params),
    responseType: "blob",
    timeout: 60_000,
  })
  const blob = new Blob([res.data], { type: "application/pdf" })
  const url = window.URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
}

/**
 * Opens the browser's print dialog for a PDF. Desktop browsers print from a hidden frame; mobile
 * browsers can't, so there the PDF opens in a new tab where the share / print menu is available.
 */
export async function printPdf(path: string, params?: Record<string, unknown>): Promise<void> {
  const res = await client.get(path, { params: cleanParams(params), responseType: "blob", timeout: 60_000 })
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  if (isMobile) {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }
  const frame = document.createElement("iframe")
  frame.style.position = "fixed"
  frame.style.width = "0"
  frame.style.height = "0"
  frame.style.border = "0"
  frame.src = url
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      window.open(url, "_blank", "noopener,noreferrer")
    }
    // Leave time for the print dialog to take the document before cleaning up.
    setTimeout(() => {
      frame.remove()
      window.URL.revokeObjectURL(url)
    }, 60_000)
  }
  document.body.appendChild(frame)
}

export function getPublicApiUrl(path: string): string {
  return `${BASE_URL}${path}`
}
