import { createContext, useContext } from 'react';
export const NotificationContext=createContext(null);
export function useNotifications(){return useContext(NotificationContext);}
