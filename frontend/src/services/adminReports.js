import { API_URL as BASE_URL } from './apiConfig.js';
import { attachNotificationInterceptor } from "./notifications";
import axios from "axios";



const api = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getAdminReports = async () => {
  const { data } = await api.get("/reports");
  return data;
};
attachNotificationInterceptor(api);
