"use client";

import axios, { type AxiosError, type AxiosInstance } from "axios";
import { env } from "../env";

/**
 * Client-side axios instance for browser → API calls. Mirrors the existing
 * client/src/utils/http/axios-interceptor.util.ts:
 *   - 401 → window.location.href = "/login"
 *   - 403 with code: "NO_ORG_MEMBERSHIP" → /onboarding/workspace
 *
 * Use this from "use client" components for streaming endpoints, file
 * uploads, or any mutation that doesn't fit a Server Action.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${env.publicApiUrl}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ code?: string }>) => {
    if (typeof window === "undefined") return Promise.reject(error);

    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status === 403 && code === "NO_ORG_MEMBERSHIP") {
      window.location.href = "/onboarding/workspace";
    } else if (status === 401) {
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);
