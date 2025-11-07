import { useState, useRef, useEffect } from "react";
import { useUser } from "../hooks/feeds/useUser";
import { Avatar } from "./Avatar";
import { useFeedActions } from "../hooks/feeds/useFeedActions";
import EmojiPicker, { Theme } from "emoji-picker-react";
import emojiIcon from "../icons/emoji.svg";
import imageIcon from "../icons/image.svg";
import pollIcon from "../icons/poll.svg";
import sendIcon from "../icons/send-msg.svg";
import "./Composer.css";

interface PollData {
  name: string;
  options: { text: string }[];
}

interface AttachmentData {
  url: string;
  type: "image" | "video";
}

export function Composer() {
  const [text, setText] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [poll, setPoll] = useState<PollData | null>(null);
  const [attachment, setAttachment] = useState<AttachmentData | null>(null);
  const maxLength = 300;
  const { user } = useUser();
  const { handlePost, posting } = useFeedActions();
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !poll && !attachment) || text.length > maxLength) return;
    await handlePost(text.trim(), poll, attachment);
    setText("");
    setPoll(null);
    setAttachment(null);
  };

  const handleEmojiClick = (emojiObject: { emoji: string }) => {
    setText((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const generateRandomPoll = (): PollData => {
    const polls = [
      {
        name: "What's your favorite programming language?",
        options: [
          { text: "JavaScript" },
          { text: "Python" },
          { text: "TypeScript" },
          { text: "Go" }
        ]
      },
      {
        name: "Best time to code?",
        options: [
          { text: "Morning" },
          { text: "Afternoon" },
          { text: "Evening" },
          { text: "Late Night" }
        ]
      },
      {
        name: "Tabs or Spaces?",
        options: [
          { text: "Tabs" },
          { text: "Spaces" },
          { text: "Doesn't matter" },
          { text: "Both" }
        ]
      },
      {
        name: "Preferred development environment?",
        options: [
          { text: "VSCode" },
          { text: "IntelliJ" },
          { text: "Vim" },
          { text: "Sublime" }
        ]
      },
      {
        name: "How do you take your coffee?",
        options: [
          { text: "Black" },
          { text: "With milk" },
          { text: "Latte" },
          { text: "I prefer tea" }
        ]
      }
    ];
    return polls[Math.floor(Math.random() * polls.length)];
  };

  const generateRandomAttachment = (): AttachmentData => {
    const attachments = [
      { url: "https://picsum.photos/seed/1/600/400", type: "image" as const },
      { url: "https://picsum.photos/seed/2/600/400", type: "image" as const },
      { url: "https://picsum.photos/seed/3/600/400", type: "image" as const },
      { url: "https://picsum.photos/seed/4/600/400", type: "image" as const },
      { url: "https://picsum.photos/seed/5/600/400", type: "image" as const },
      { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", type: "video" as const },
    ];
    return attachments[Math.floor(Math.random() * attachments.length)];
  };

  const handleAddPoll = () => {
    if (attachment) {
      setAttachment(null);
    }
    setPoll(generateRandomPoll());
    setShowEmojiPicker(false);
  };

  const handleAddAttachment = () => {
    if (poll) {
      setPoll(null);
    }
    setAttachment(generateRandomAttachment());
    setShowEmojiPicker(false);
  };

  const handleRemovePoll = () => {
    setPoll(null);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
  };

  // Handle clicks outside emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const characterCount = text.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.9;

  return (
    <div className={`composer-container ${isActive ? "active" : ""}`}>
      <form onSubmit={handleSubmit}>
        <div className="composer-form-container">
          <Avatar userName={user?.name} userId={user?.nickname} size="md" style={{ marginTop: "8px" }}/>
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                  if (text.trim() && text.length <= maxLength) {
                    handleSubmit(e as React.FormEvent);
                  }
                }
              }}
              placeholder="What's happening?"
              rows={3}
              onFocus={() => setIsActive(true)}
              onBlur={() => setIsActive(false)}
              className="composer-textarea"
              disabled={posting}
            />

            {poll && (
              <div className="composer-poll-preview">
                <div className="composer-poll-header">
                  <span className="composer-poll-title">📊 Poll</span>
                  <button
                    type="button"
                    onClick={handleRemovePoll}
                    className="composer-remove-button"
                    title="Remove poll"
                  >
                    ✕
                  </button>
                </div>
                <div className="composer-poll-question">{poll.name}</div>
                <div className="composer-poll-options">
                  {poll.options.map((option, index) => (
                    <div key={index} className="composer-poll-option">
                      {option.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attachment && (
              <div className="composer-attachment-preview">
                <div className="composer-attachment-header">
                  <span className="composer-attachment-title">
                    {attachment.type === "image" ? "🖼️ Image" : "🎥 Video"}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="composer-remove-button"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
                <div className="composer-attachment-content">
                  {attachment.type === "image" ? (
                    <img src={attachment.url} alt="Attachment preview" className="composer-attachment-image" />
                  ) : (
                    <video src={attachment.url} controls className="composer-attachment-video" />
                  )}
                </div>
              </div>
            )}

            <div className="composer-controls">
              <div className="composer-media-buttons">
                <button
                  ref={emojiButtonRef}
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="composer-media-button"
                  title="Add emoji"
                >
                  <img
                    src={emojiIcon}
                    alt="Add emoji"
                    width="18"
                    height="18"
                    className="composer-icon"
                  />
                </button>
                <button
                  type="button"
                  onClick={handleAddPoll}
                  className="composer-media-button"
                  title="Add poll"
                  disabled={posting}
                >
                  <img
                    src={pollIcon}
                    alt="Add poll"
                    width="18"
                    height="18"
                    className="composer-icon"
                  />
                </button>
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="composer-media-button"
                  title="Add attachment"
                  disabled={posting}
                >
                  <img
                    src={imageIcon}
                    alt="Add attachment"
                    width="18"
                    height="18"
                    className="composer-icon"
                  />
                </button>

                {showEmojiPicker && (
                  <div
                    ref={emojiPickerRef}
                    className="emoji-picker-container"
                  >
                    <EmojiPicker
                      theme={Theme.LIGHT}
                      onEmojiClick={handleEmojiClick}
                    />
                  </div>
                )}
              </div>

              <div className="composer-submission-area">
                <div className="character-count-container">
                  <div
                    className={`character-indicator ${
                      isOverLimit
                        ? "danger"
                        : isNearLimit
                        ? "warning"
                        : "safe"
                    }`}
                  />
                  <span
                    className={`character-count ${
                      isOverLimit
                        ? "danger"
                        : isNearLimit
                        ? "warning"
                        : "safe"
                    }`}
                  >
                    {characterCount}/{maxLength}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={(!text.trim() && !poll && !attachment) || posting || isOverLimit}
                  className="composer-submit-button"
                >
                  {posting ? (
                    <>
                      <div className="submit-spinner" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <img
                        src={sendIcon}
                        alt="Send"
                        width="18"
                        height="18"
                        className="composer-icon"
                      />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
