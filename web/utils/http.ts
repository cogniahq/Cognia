"use client";

/**
 * Thin wrappers around the shared axios apiClient that mirror the call
 * signatures the ported services expected from
 * client/src/utils/http/general-services.util.ts. The 401/403 interceptor
 * lives on apiClient itself so we don't repeat redirect logic here.
 *
 * Each helper swallows axios errors that have a `response` (so service
 * code can read `res.data?.success === false`) but re-throws on network
 * failures — same contract as the Vite originals.
 */

import type { AxiosError, AxiosResponse } from "axios";

import { apiClient } from "@/lib/api/client";

type Callback = (res: AxiosResponse) => void;

function isErrorWithResponse(err: unknown): err is AxiosError {
  return typeof err === "object" && err !== null && "response" in err;
}

export const getRequest = async (
  route: string,
  callback?: Callback,
  signal?: AbortSignal,
) => {
  try {
    const res = await apiClient.get(route, {
      signal,
      timeout: signal ? 0 : 30000,
    });
    if (callback) callback(res);
    return res;
  } catch (err: unknown) {
    if (isErrorWithResponse(err) && err.response) {
      if (callback) callback(err.response);
      return err.response;
    }
    throw err;
  }
};

export const postRequest = async (
  route: string,
  data: unknown,
  callback?: Callback,
  signal?: AbortSignal,
  timeout?: number,
) => {
  try {
    const res = await apiClient.post(route, data, {
      signal,
      timeout: timeout !== undefined ? timeout : signal ? 0 : 30000,
    });
    if (callback) callback(res);
    return res;
  } catch (err: unknown) {
    if (isErrorWithResponse(err) && err.response) {
      if (callback) callback(err.response);
      return err.response;
    }
    throw err;
  }
};

export const patchRequest = async (
  route: string,
  data: unknown,
  callback?: Callback,
) => {
  try {
    const res = await apiClient.patch(route, data);
    if (callback) callback(res);
    return res;
  } catch (err: unknown) {
    if (isErrorWithResponse(err) && err.response) {
      if (callback) callback(err.response);
      return err.response;
    }
    throw err;
  }
};

export const putRequest = async (
  route: string,
  data: unknown,
  callback?: Callback,
) => {
  try {
    const res = await apiClient.put(route, data);
    if (callback) callback(res);
    return res;
  } catch (err: unknown) {
    if (isErrorWithResponse(err) && err.response) {
      if (callback) callback(err.response);
      return err.response;
    }
    throw err;
  }
};

export const deleteRequest = async (route: string, callback?: Callback) => {
  try {
    const res = await apiClient.delete(route);
    if (callback) callback(res);
    return res;
  } catch (err: unknown) {
    if (isErrorWithResponse(err) && err.response) {
      if (callback) callback(err.response);
      return err.response;
    }
    throw err;
  }
};
