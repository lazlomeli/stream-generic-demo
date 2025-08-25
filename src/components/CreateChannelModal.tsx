import React, { useState, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoadingSpinner from './LoadingSpinner';
import './CreateChannelModal.css';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channelId: string) => void;
  availableUsers: Array<{
    id: string;
    name: string;
    image?: string;
  }>;
  currentUserId?: string;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  onChannelCreated,
  availableUsers,
  currentUserId
}) => {
  const { getAccessTokenSilently } = useAuth0();
  
  const [channelName, setChannelName] = useState('');
  const [channelImage, setChannelImage] = useState<File | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setChannelImage(file);
    }
  };

  const handleUserToggle = (userId: string) => {
    const newSelectedUsers = new Set(selectedUsers);
    if (newSelectedUsers.has(userId)) {
      newSelectedUsers.delete(userId);
    } else {
      newSelectedUsers.add(userId);
    }
    setSelectedUsers(newSelectedUsers);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!channelName.trim()) {
      setError('Channel name is required');
      return;
    }

    if (selectedUsers.size === 0) {
      setError('Please select at least one user to add to the channel');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const accessToken = await getAccessTokenSilently();
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('channelName', channelName.trim());
      formData.append('selectedUsers', JSON.stringify(Array.from(selectedUsers)));
      formData.append('currentUserId', currentUserId || '');
      if (channelImage) {
        formData.append('channelImage', channelImage);
      }

      const response = await fetch('/api/stream/create-channel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create channel');
      }

      const result = await response.json();
      
      // Show success message
      setSuccess('Channel created successfully!');
      
      // Reset form
      setChannelName('');
      setChannelImage(null);
      setSelectedUsers(new Set());
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onChannelCreated(result.channelId);
        onClose();
      }, 1500);
      
    } catch (err: any) {
      console.error('Error creating channel:', err);
      setError(err.message || 'Failed to create channel');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setChannelName('');
      setChannelImage(null);
      setSelectedUsers(new Set());
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  return (
    <div className="create-channel-modal-overlay" onClick={handleClose}>
      <div className="create-channel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Channel</h3>
          <button 
            className="modal-close-button"
            onClick={handleClose}
            disabled={isCreating}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-content">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="channelName">Channel Name *</label>
            <input
              id="channelName"
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Enter channel name"
              className="form-input"
              disabled={isCreating}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="channelImage">Channel Image (Optional)</label>
            <div className="image-upload-container">
              <input
                ref={fileInputRef}
                id="channelImage"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                disabled={isCreating}
              />
              <button
                type="button"
                className="image-upload-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCreating}
              >
                {channelImage ? (
                  <div className="selected-image">
                    <img 
                      src={URL.createObjectURL(channelImage)} 
                      alt="Selected" 
                      className="preview-image"
                    />
                    <span className="image-name">{channelImage.name}</span>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📷</span>
                    <span>Choose Image</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Add Members *</label>
            <div className="users-selection">
              {availableUsers.map((user) => (
                <label key={user.id} className="user-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={() => handleUserToggle(user.id)}
                    disabled={isCreating}
                  />
                  <div className="user-info">
                    <img 
                      src={user.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEyIDExQzE0LjIwOTEgMTEgMTYgOS4yMDkxIDkgMTYgMTEgMTQgMTQgMTEgMTIgMTFaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTJDMTAuMzQzMSAxMiA5IDEzLjM0MzEgOSAxNVYxN0gxNVYxNUMxNSAxMy4zNDMxIDEzLjY1NjkgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+'} 
                      alt={user.name}
                      className="user-avatar"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEyIDExQzE0LjIwOTEgMTEgMTYgOS4yMDkxIDkgMTYgMTEgMTQgMTQgMTEgMTIgMTFaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTJDMTAuMzQzMSAxMiA5IDEzLjM0MzEgOSAxNVYxN0gxNVYxNUMxNSAxMy4zNDMxIDEzLjY1NjkgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+';
                      }}
                    />
                    <span className="user-name">{user.name}</span>
                  </div>
                </label>
              ))}
            </div>
            <p className="help-text">Select at least one user to add to the channel</p>
          </div>

          <div className="modal-actions">
            <button 
              type="button"
              className="modal-cancel-button"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="modal-submit-button"
              disabled={isCreating || !channelName.trim() || selectedUsers.size === 0}
            >
              {isCreating ? (
                <>
                  <LoadingSpinner />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Channel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
