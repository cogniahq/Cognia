/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosResponse } from "axios"

import axiosInstance from "./axios-interceptor.util"

export const getRequest = async (
  route: string,
  callback?: (res: AxiosResponse) => void,
  signal?: AbortSignal
) => {
  try {
    const res = await axiosInstance.get(route, {
      signal,
      timeout: signal ? 0 : 30000, // Disable timeout if AbortSignal is provided
    })
    if (callback) callback(res)
    return res
  } catch (err: any) {
    if (callback) callback(err)
    return err.response
  }
}

export const postRequest = async (
  route: string,
  data: any,
  callback?: (res: AxiosResponse) => void,
  signal?: AbortSignal,
  timeout?: number
) => {
  try {
    const res = await axiosInstance.post(route, data, {
      signal,
      timeout: timeout !== undefined ? timeout : signal ? 0 : 30000, // Use provided timeout, or disable if AbortSignal is provided, or default to 30s
    })
    if (callback) callback(res)
    return res
  } catch (err: any) {
    if (callback) callback(err.response || err)
    if (err.response) {
      return err.response
    }
    throw err
  }
}

export const patchRequest = async (
  route: string,
  data: any,
  callback?: (res: AxiosResponse) => void
) => {
  try {
    const res = await axiosInstance.patch(route, data)
    if (callback) callback(res)
    return res
  } catch (err: any) {
    if (callback) callback(err)
    return err.response
  }
}

export const putRequest = async (
  route: string,
  data: any,
  callback?: (res: AxiosResponse) => void
) => {
  try {
    const res = await axiosInstance.put(route, data)
    if (callback) callback(res)
    return res
  } catch (err: any) {
    if (callback) callback(err)
    return err.response
  }
}

export const deleteRequest = async (
  route: string,
  callback?: (res: AxiosResponse) => void
) => {
  try {
    const res = await axiosInstance.delete(route)
    if (callback) callback(res)
    return res
  } catch (err: any) {
    if (callback) callback(err)
    return err.response
  }
}
