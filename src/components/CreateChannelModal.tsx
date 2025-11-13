import React, { useState, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { generateAvatarUrl } from '../utils/avatarUtils';
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
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleUserToggle = (userId: string) => {
    if (isDM) {
      setSelectedUsers(new Set([userId]));
    } else {
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

    if (currentUserId && selectedUsers.has(currentUserId)) {
      console.error('Current user found in selected users!');
      setError('Cannot add yourself to the channel');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const accessToken = await getAccessTokenSilently();
      
      let finalChannelName = isDM ? '' : channelName.trim();
      let channelImageData = null;
      
      if (!isDM && channelImage) {
        channelImageData = channelImage;
      }
      
      const requestBody = {
        userId: currentUserId || '',
        channelName: finalChannelName,
        selectedUsers: JSON.stringify(Array.from(selectedUsers)),
        isDM: isDM,
        channelImage: channelImageData
      };

      const response = await fetch('/api/chat-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: 'create-channel',
          ...requestBody
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create channel');
      }

      const result = await response.json();
      
      if (result.existing) {
        setSuccess(isDM ? 'Opening existing conversation...' : 'Channel already exists, opening it...');
      } else {
        setSuccess(isDM ? 'Direct message created successfully!' : 'Channel created successfully!');
      }
      
      setChannelName('');
      setSelectedUsers(new Set());
      onChannelCreated(result.channelId);
      
      setTimeout(() => {
        onClose();
      }, 800);
      
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
      setUserSearchQuery('');
      onClose();
    }
  };

  const filteredUsers = availableUsers
    .filter(user => {
      const isCurrentUser = user.id === currentUserId;
      if (isCurrentUser) {
        console.log('Filtering out current user:', user.id, user.name);
      }
      return !isCurrentUser;
    })
    .filter(user => user.name.toLowerCase().includes(userSearchQuery.toLowerCase()));
  
  console.log(`Showing ${filteredUsers.length} users (total available: ${availableUsers.length}, current user: ${currentUserId})`);

  return (
    <div className="create-channel-modal-overlay" onClick={handleClose}>
      <div className={`create-channel-modal ${isDM ? 'dm-modal' : ''}`} onClick={(e) => e.stopPropagation()}>
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
              <label style={{ fontSize: 'small' }} className='form-group-label' htmlFor="channelName">Channel Name *</label>
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
            <div className="user-search-container">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="user-search-input"
                disabled={isCreating}
              />
            </div>

            <div className="users-selection">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <label key={user.id} className="user-checkbox">
                    <input
                      type={isDM ? "radio" : "checkbox"}
                      name={isDM ? "dmUser" : undefined}
                      checked={selectedUsers.has(user.id)}
                      onChange={() => handleUserToggle(user.id)}
                      disabled={isCreating}
                      className="user-checkbox-input"
                    />
                    <div className="user-info">
                      <img 
                        src={user.image || generateAvatarUrl(user.id)} 
                        alt={user.name}
                        className="user-avatar"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = generateAvatarUrl(user.id);
                        }}
                      />
                      <span className="user-name">{user.name}</span>
                    </div>
                  </label>
                ))
              ) : (
                <div className="no-users-found">
                  {userSearchQuery ? `No users found matching "${userSearchQuery}"` : 'No users available'}
                </div>
              )}
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
                <LoadingIcon size={48} />
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
