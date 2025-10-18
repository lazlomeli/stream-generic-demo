"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Image, Smile, ListTodo } from "lucide-react";
import { useUser } from "../hooks/feeds/useUser";
import { Avatar } from "./Avatar";
import { useFeedActions } from "../hooks/feeds/useFeedActions";
import EmojiPicker, { Theme } from "emoji-picker-react";
import "./Composer.css";

export function Composer() {
  const [text, setText] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const maxLength = 280; // Twitter-like character limit
  const { user } = useUser();
  const { handlePost, posting } = useFeedActions();
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.length > maxLength) return;
    await handlePost(text.trim());
    setText("");
  };

  const handleEmojiClick = (emojiObject: { emoji: string }) => {
    setText((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
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
          <Avatar userName={user?.name} userId={user?.nickname} size="md" />
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

            <div className="composer-controls">
              <div className="composer-media-buttons">
                <button
                  ref={emojiButtonRef}
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="composer-media-button"
                  title="Add emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("comming soon!");
                  }}
                  className="composer-media-button"
                  title="Add poll"
                >
                  <ListTodo className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("comming soon!");
                  }}
                  className="composer-media-button"
                  title="Add image"
                >
                  <Image className="w-5 h-5" />
                </button>

                {showEmojiPicker && (
                  <div
                    ref={emojiPickerRef}
                    className="emoji-picker-container"
                  >
                    <EmojiPicker
                      theme={Theme.DARK}
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
                  disabled={!text.trim() || posting || isOverLimit}
                  className="composer-submit-button"
                >
                  {posting ? (
                    <>
                      <div className="submit-spinner" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Post</span>
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
