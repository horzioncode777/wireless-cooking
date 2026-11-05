import { API_URL as BASE_URL } from './apiConfig.js';
import { attachNotificationInterceptor } from "./notifications";
import axios from "axios";



const adminSellersApi = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
});

adminSellersApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const getAdminSellers = async () => {
  const { data } = await adminSellersApi.get("/sellers");
  return data;
};

export const getAdminSellerById = async (id) => {
  const { data } = await adminSellersApi.get(`/sellers/${id}`);
  return data;
};

export const updateSellerVerification = async (id, verificado) => {
  const { data } = await adminSellersApi.patch(`/sellers/${id}/verification`, {
    verificado,
  });
  return data;
};

export const updateSellerUserStatus = async (id, estado) => {
  const { data } = await adminSellersApi.patch(`/sellers/${id}/user-status`, {
    estado,
  });
  return data;
};
attachNotificationInterceptor(adminSellersApi);
