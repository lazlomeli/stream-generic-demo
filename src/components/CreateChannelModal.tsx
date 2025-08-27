import React, { useState, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoadingIcon from './LoadingIcon';
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
  isDM?: boolean;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  onChannelCreated,
  availableUsers,
  currentUserId,
  isDM = false
}) => {
  const { getAccessTokenSilently } = useAuth0();
  
  const [channelName, setChannelName] = useState('');
  const [channelImage, setChannelImage] = useState<File | null>(null);
  const [compressedImageUrl, setCompressedImageUrl] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleUserToggle = (userId: string) => {
    if (isDM) {
      // For DM, only allow one user selection (radio button behavior)
      setSelectedUsers(new Set([userId]));
    } else {
      // For groups, allow multiple selections (checkbox behavior)
      const newSelectedUsers = new Set(selectedUsers);
      if (newSelectedUsers.has(userId)) {
        newSelectedUsers.delete(userId);
      } else {
        newSelectedUsers.add(userId);
      }
      setSelectedUsers(newSelectedUsers);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!isDM && !channelName.trim()) {
      setError('Channel name is required');
      return;
    }

    if (selectedUsers.size === 0) {
      setError(isDM ? 'Please select a user to message' : 'Please select at least one user to add to the channel');
      return;
    }

    if (isDM && selectedUsers.size > 1) {
      setError('Please select only one user for direct message');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const accessToken = await getAccessTokenSilently();
      
      // For DM, get the selected user's details
      let finalChannelName = channelName.trim();
      let channelImageData = null;
      
      if (isDM) {
        const selectedUserId = Array.from(selectedUsers)[0];
        const selectedUser = availableUsers.find(user => user.id === selectedUserId);
        if (selectedUser) {
          finalChannelName = selectedUser.name;
          channelImageData = selectedUser.image;
        }
      }
      
      // Create request body
      const requestBody = {
        channelName: finalChannelName,
        selectedUsers: JSON.stringify(Array.from(selectedUsers)),
        currentUserId: currentUserId || '',
        isDM: isDM,
        channelImage: channelImageData
      };

      const response = await fetch('/api/stream/create-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create channel');
      }

      const result = await response.json();
      
      console.log('✅ Channel creation response:', result);
      console.log('🆔 Created channel ID:', result.channelId);
      
      // Show success message
      setSuccess('Channel created successfully!');
      
      // Reset form
      setChannelName('');
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
      setCompressedImageUrl(null);
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
          <h3>{isDM ? 'Start Direct Message' : 'Create New Channel'}</h3>
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

          {!isDM && (
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
          )}

          <div className="form-group">
            <label>{isDM ? 'Select User to Message *' : 'Add Members *'}</label>
            <div className="users-selection">
              {availableUsers.map((user) => (
                <label key={user.id} className="user-checkbox">
                  <input
                    type={isDM ? "radio" : "checkbox"}
                    name={isDM ? "dmUser" : undefined}
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
            <p className="help-text">{isDM ? 'Select one user to start a direct message' : 'Select at least one user to add to the channel'}</p>
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
              disabled={isCreating || (!isDM && !channelName.trim()) || selectedUsers.size === 0}
            >
              {isCreating ? (
                <LoadingIcon size={16} />
              ) : (
                isDM ? 'Start Message' : 'Create Channel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
