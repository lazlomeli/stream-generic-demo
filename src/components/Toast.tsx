import React from 'react';
import { useToast, Toast as ToastType } from '../contexts/ToastContext';
import './Toast.css';

interface ToastProps {
  toast: ToastType;
}

const Toast: React.FC<ToastProps> = ({ toast }) => {
  const { fadeOutToast } = useToast();

  const handleClose = () => {
    fadeOutToast(toast.id);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`toast toast-${toast.type} ${toast.isRemoving ? 'fade-out' : ''}`}>
      <div className="toast-content">
        <span className="toast-icon">{getIcon()}</span>
        <span className="toast-message">{toast.message}</span>
        <button className="toast-close" onClick={handleClose} aria-label="Close notification">
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
