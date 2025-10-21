
export function getMessagePreview(message: any): string {
  if (!message) return '';

  let messageText = message.text || '';

  if (!messageText && message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    messageText = getAttachmentPreview(attachment.type, message.custom?.previewText);
  }

  if (message.text && message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    const attachmentIndicator = getAttachmentIndicator(attachment.type);
    
    if (attachmentIndicator) {
      messageText = message.text + attachmentIndicator;
    }
  }

  return messageText;
}

function getAttachmentPreview(attachmentType: string | undefined, customPreviewText?: string): string {
  switch (attachmentType) {
    case 'voiceRecording':
      return customPreviewText || '🎤 Voice Message';
    case 'poll':
      return '📊 Poll';
    case 'image':
      return '📷 Photo';
    case 'video':
      return '🎥 Video';
    case 'file':
      return '📎 File';
    case 'giphy':
      return '🎬 GIF';
    default:
      return '📎 Attachment';
  }
}

function getAttachmentIndicator(attachmentType: string | undefined): string {
  switch (attachmentType) {
    case 'voiceRecording':
      return '';
    case 'poll':
      return ' 📊';
    case 'image':
      return ' 📷';
    case 'video':
      return ' 🎥';
    case 'file':
      return ' 📎';
    case 'giphy':
      return ' 🎬';
    default:
      return '';
  }
}

export function formatMessageWithSender(
  messageText: string,
  senderId: string | undefined,
  senderName: string | undefined,
  currentUserId: string
): string {
  if (!messageText || !senderId) return messageText;

  const name = senderName || senderId;
  const isOwnMessage = senderId === currentUserId;
  
  return isOwnMessage ? `You: ${messageText}` : `${name}: ${messageText}`;
}

