import { Navigate,Outlet } from 'react-router-dom';
import { readUser } from '../services/api';
export default function ProtectedRoute({seller=false}){
 const user=readUser();
 if(!localStorage.getItem('token')||!user)return <Navigate to="/login" replace/>;
 if(seller&&!['vendedor','admin'].includes(user.rol))return <Navigate to="/perfil" replace/>;
 return <Outlet/>;
}
