import { API_URL as BASE_URL } from './apiConfig.js';
import { attachNotificationInterceptor } from "./notifications";
import axios from "axios";



const adminApi = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const getAdminProducts = async () => {
  const { data } = await adminApi.get("/products");
  return data;
};

export const getAdminCategories = async () => {
  const { data } = await adminApi.get("/categories");
  return data;
};

export const createAdminProduct = async (productData) => {
  const { data } = await adminApi.post("/products", productData);
  return data;
};

export const updateAdminProduct = async (id, productData) => {
  const { data } = await adminApi.put(`/products/${id}`, productData);
  return data;
};

export const deleteAdminProduct = async (id) => {
  const { data } = await adminApi.delete(`/products/${id}`);
  return data;
};
attachNotificationInterceptor(adminApi);
