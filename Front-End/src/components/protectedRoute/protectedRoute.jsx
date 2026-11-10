import { Navigate } from "react-router-dom";
import {useAuth} from "../AuthContext/authContext.jsx"

export default function ProtectedRoute({children}){
    const {user, isLoading} = useAuth()

    if (isLoading) {
        return <div role="status">Restoring your session...</div>
    }
    if(!user){
        return <Navigate to="/login" replace />
    }
    return children
}