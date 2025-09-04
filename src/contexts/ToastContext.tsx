import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
  isRemoving?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  fadeOutToast: (id: string) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const MAX_TOASTS = 5;

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const fadeOutToast = useCallback((id: string) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, isRemoving: true } : toast
    ));
    
    // Remove toast after fade-out animation completes
    setTimeout(() => {
      removeToast(id);
    }, 300); // Match the fadeSlideOut animation duration
  }, [removeToast]);

  const addToast = useCallback((toastData: Omit<Toast, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const duration = toastData.duration || 5000;
    
    const newToast: Toast = {
      ...toastData,
      id,
      duration
    };

    setToasts(prev => {
      // Remove oldest toasts if we exceed the limit
      const updatedToasts = prev.length >= MAX_TOASTS 
        ? prev.slice(-(MAX_TOASTS - 1))
        : prev;
      
      return [...updatedToasts, newToast];
    });

    // Auto-remove toast after duration with fade-out
    setTimeout(() => {
      fadeOutToast(id);
    }, duration);
  }, [fadeOutToast]);

  const showSuccess = useCallback((message: string, duration?: number) => {
    addToast({ type: 'success', message, duration });
  }, [addToast]);

  const showError = useCallback((message: string, duration?: number) => {
    addToast({ type: 'error', message, duration });
  }, [addToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    addToast({ type: 'info', message, duration });
  }, [addToast]);

  const contextValue: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    fadeOutToast,
    showSuccess,
    showError,
    showInfo
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
};
