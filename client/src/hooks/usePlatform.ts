import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { PlatformEndpoints } from "@/endpoints/platform.endpoints"
import { ApiError } from "@/transport/http"

export const PLATFORM_KEY = "platform"

const viewerTimezone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
})()

export function usePlatformOverview(days = 30) {
  return useQuery({
    queryKey: [PLATFORM_KEY, "overview", days],
    queryFn: async () => {
      const res = await PlatformEndpoints.overview({ tz: viewerTimezone, days })
      if (!res.success || !res.data) throw new ApiError(res.message, res.statusCode)
      return res.data
    },
    refetchInterval: 60_000,
  })
}

export function usePlatformBusinesses(params: Record<string, unknown>) {
  return useQuery({
    queryKey: [PLATFORM_KEY, "businesses", params],
    queryFn: async () => {
      const res = await PlatformEndpoints.businesses(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    placeholderData: keepPreviousData,
  })
}

export function usePlatformUsers(params: Record<string, unknown>) {
  return useQuery({
    queryKey: [PLATFORM_KEY, "users", params],
    queryFn: async () => {
      const res = await PlatformEndpoints.users(params)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return { data: res.data ?? [], meta: res.meta }
    },
    placeholderData: keepPreviousData,
  })
}

export function usePlatformLogins(limit = 30) {
  return useQuery({
    queryKey: [PLATFORM_KEY, "logins", limit],
    queryFn: async () => {
      const res = await PlatformEndpoints.logins(limit)
      if (!res.success) throw new ApiError(res.message, res.statusCode)
      return res.data ?? []
    },
    refetchInterval: 60_000,
  })
}
