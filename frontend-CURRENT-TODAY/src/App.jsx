import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, dashboardPathForRole, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Loading from "./components/Loading";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Stores from "./pages/Stores";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Analytics from "./pages/Analytics";
import Forecast from "./pages/Forecast";
import Replenishment from "./pages/Replenishment";
import StoresMap from "./pages/StoresMap";
import UserManagement from "./pages/UserManagement";
import SetPassword from "./pages/SetPassword";
import StaffDashboard from "./pages/StaffDashboard";

function HomeRedirect() { const { isAuthenticated, isLoading, user } = useAuth(); if (isLoading) return <Loading label="Checking your session" />; return <Navigate to={isAuthenticated ? dashboardPathForRole(user.role) : "/login"} replace />; }
function RoleRoute({ roles }) { const { user } = useAuth(); return roles.includes(user?.role) ? <Outlet /> : <Navigate to={dashboardPathForRole(user?.role)} replace />; }
function DashboardHome() { const { user } = useAuth(); return <Navigate to={dashboardPathForRole(user?.role)} replace />; }

export default function App() {
	return <BrowserRouter><AuthProvider><Routes>
		<Route path="/login" element={<Login />} />
		<Route path="/set-password" element={<SetPassword />} />
		<Route path="/" element={<HomeRedirect />} />
		<Route path="/register" element={<Navigate to="/login" replace />} />
		<Route element={<ProtectedRoute />}><Route element={<Layout />}>
			<Route path="/dashboard" element={<DashboardHome />} />
			<Route element={<RoleRoute roles={["admin"]} />}>
				<Route path="/admin-dashboard" element={<Dashboard />} />
				<Route path="/user-management" element={<UserManagement />} />
			</Route>
			<Route element={<RoleRoute roles={["manager"]} />}><Route path="/manager-dashboard" element={<Dashboard />} /></Route>
			<Route element={<RoleRoute roles={["cashier"]} />}><Route path="/cashier-dashboard" element={<StaffDashboard />} /></Route>
			<Route element={<RoleRoute roles={["inventory_staff"]} />}><Route path="/inventory-dashboard" element={<StaffDashboard />} /></Route>
			<Route element={<RoleRoute roles={["admin", "manager", "cashier", "inventory_staff"]} />}>
				<Route path="/products" element={<Products />} />
				<Route path="/inventory" element={<Inventory />} />
			</Route>
			<Route element={<RoleRoute roles={["admin", "manager"]} />}>
				<Route path="/stores" element={<Stores />} />
				<Route path="/analytics" element={<Analytics />} />
				<Route path="/forecast" element={<Forecast />} />
				<Route path="/replenishment" element={<Replenishment />} />
				<Route path="/stores-map" element={<StoresMap />} />
			</Route>
			<Route element={<RoleRoute roles={["admin", "manager", "cashier"]} />}><Route path="/sales" element={<Sales />} /></Route>
		</Route></Route>
		<Route path="*" element={<HomeRedirect />} />
	</Routes></AuthProvider></BrowserRouter>;
}
