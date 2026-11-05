import { API_URL as BASE_URL } from './apiConfig.js';
import { attachNotificationInterceptor } from "./notifications";
import axios from "axios";



const adminOrdersApi = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
});

adminOrdersApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const getAdminOrders = async () => {
  const { data } = await adminOrdersApi.get("/orders");
  return data;
};

export const getAdminOrderById = async (id) => {
  const { data } = await adminOrdersApi.get(`/orders/${id}`);
  return data;
};

export const updateAdminOrderStatus = async (id, estado) => {
  const { data } = await adminOrdersApi.patch(`/orders/${id}/status`, {
    estado,
  });
  return data;
};
attachNotificationInterceptor(adminOrdersApi);
export const updateAdminOrderDelivery=async(id,details)=>{
 const {data}=await adminOrdersApi.patch(`/orders/${id}/delivery`,details);
 return data;
};
