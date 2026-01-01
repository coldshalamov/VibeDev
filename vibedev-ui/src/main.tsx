import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// Configure React Query client with sensible defaults for real-time updates
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // Data is fresh for 5 seconds
      refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
      refetchOnWindowFocus: true,
      retry: 2,
    },
    mutations: {
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
