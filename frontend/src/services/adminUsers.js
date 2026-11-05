import { API_URL as BASE_URL } from './apiConfig.js';
import { attachNotificationInterceptor } from "./notifications";
import axios from "axios";



const adminUsersApi = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
});

adminUsersApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const getAdminUsers = async () => {
  const { data } = await adminUsersApi.get("/users");
  return data;
};

export const updateAdminUserStatus = async (id, estado) => {
  const { data } = await adminUsersApi.patch(`/users/${id}/status`, {
    estado,
  });
  return data;
};
attachNotificationInterceptor(adminUsersApi);
