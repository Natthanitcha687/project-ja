// import React, { createContext, useContext, useState, useEffect } from 'react';
// import { jwtDecode } from 'jwt-decode';
// import axios from 'axios';

// const AuthContext = createContext();

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// };

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [token, setToken] = useState(localStorage.getItem('token'));
//   const [loading, setLoading] = useState(true);

//   // Configure axios defaults
//   useEffect(() => {
//     if (token) {
//       axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
//       try {
//         const decoded = jwtDecode(token);
//         const currentTime = Date.now() / 1000;
        
//         if (decoded.exp < currentTime) {
//           // Token expired
//           logout();
//         } else {
//           setUser(decoded);
//         }
//       } catch (error) {
//         console.error('Invalid token:', error);
//         logout();
//       }
//     }
//     setLoading(false);
//   }, [token]);

//   const login = async (email, password) => {
//     try {
//       const response = await axios.post('http://localhost:3001/auth/login', {
//         email,
//         password
//       });

//       const { token: newToken, user: userData } = response.data.data;
      
//       localStorage.setItem('token', newToken);
//       setToken(newToken);
//       setUser(userData);
      
//       axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
//       return { success: true, user: userData };
//     } catch (error) {
//       console.error('Login error:', error);
//       return { 
//         success: false, 
//         error: error.response?.data?.message || 'Login failed' 
//       };
//     }
//   };

//   const registerCustomer = async (userData) => {
//     try {
//       const response = await axios.post('http://localhost:3001/auth/register/customer', userData);
//       return { success: true, data: response.data.data };
//     } catch (error) {
//       console.error('Customer registration error:', error);
//       return { 
//         success: false, 
//         error: error.response?.data?.message || 'Registration failed' 
//       };
//     }
//   };

//   const registerStore = async (storeData) => {
//     try {
//       const response = await axios.post('http://localhost:3001/auth/register/store', storeData);
//       return { success: true, data: response.data.data };
//     } catch (error) {
//       console.error('Store registration error:', error);
//       return { 
//         success: false, 
//         error: error.response?.data?.message || 'Registration failed' 
//       };
//     }
//   };

//   const logout = () => {
//     localStorage.removeItem('token');
//     setToken(null);
//     setUser(null);
//     delete axios.defaults.headers.common['Authorization'];
//   };

//   const verifyEmail = async (token) => {
//     try {
//       const response = await axios.get(`http://localhost:3001/auth/verify-email/${token}`);
//       return { success: true, data: response.data.data };
//     } catch (error) {
//       console.error('Email verification error:', error);
//       return { 
//         success: false, 
//         error: error.response?.data?.message || 'Verification failed' 
//       };
//     }
//   };

//   const resendVerificationEmail = async (email) => {
//     try {
//       const response = await axios.post('http://localhost:3001/auth/resend-verification', { email });
//       return { success: true, data: response.data.data };
//     } catch (error) {
//       console.error('Resend verification error:', error);
//       return { 
//         success: false, 
//         error: error.response?.data?.message || 'Failed to resend verification email' 
//       };
//     }
//   };

//   const forgotPassword = async (email) => {
//     try {
//       const response = await axios.post('http://localhost:3001/auth/forgot-password', { email });
//       return { success: true, data: response.data.data };
//     } catch (error) {
//       console.error('Forgot password error:', error);
//       return { 
//         success: false, 
//         error: error.response?.data?.message || 'Failed to send password reset email' 
//       };
//     }
//   };

//   const resetPassword = async (token, password) => {
//     try {
//       const response = await axios.post(`http://localhost:3001/auth/reset-password/${token}`, { password });
//       return { success: true, data: response.data.data };
//     } catch (error) {
//       console.error('Reset password error:', error);
//       return { 
//         success: false, 
//         error: error.response?.data?.message || 'Failed to reset password' 
//       };
//     }
//   };

//   const value = {
//     user,
//     token,
//     loading,
//     login,
//     logout,
//     registerCustomer,
//     registerStore,
//     verifyEmail,
//     resendVerificationEmail,
//     forgotPassword,
//     resetPassword,
//     isAuthenticated: !!user,
//     isVerified: user?.isVerified || false,
//     role: user?.role || null
//   };

//   return (
//     <AuthContext.Provider value={value}>
//       {children}
//     </AuthContext.Provider>
//   );
// };
