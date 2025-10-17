// CommentsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { ActivityResponse, CommentResponse } from "@stream-io/feeds-client";
import { Heart, TextQuote, Trash2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { useUser } from "../hooks/feeds/useUser";
import { useComments } from "../hooks/feeds/useComments";
import toast from "react-hot-toast";
import "./Comment.css";

interface CommentsPanelProps {
  activity: ActivityResponse;
}

interface CommentWithReplies extends CommentResponse {
  replies: CommentWithReplies[];
}

// Separate ReplyForm component with its own state
const ReplyForm = ({
  comment,
  onReply,
  onCancel,
  isLoading,
}: {
  comment: CommentResponse;
  onReply: (text: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  const [replyText, setReplyText] = useState("");
  const { user } = useUser();

  const handleSubmit = () => {
    if (replyText.trim() && replyText.length <= 280) {
      onReply(replyText);
      setReplyText("");
    }
  };

  const handleCancel = () => {
    setReplyText("");
    onCancel();
  };

  return (
    <div className="reply-form-container">
      <div className="reply-form-wrapper">
        <Avatar userName={user?.name} size="sm" />
        <div className="reply-form-content">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Reply to ${comment.user?.name || "unknown"}...`}
            className="reply-textarea"
            style={{ direction: "ltr", textAlign: "left" }}
            rows={2}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading && replyText.trim() && replyText.length <= 280) {
                  handleSubmit();
                }
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
          />
          <div className="reply-controls">
            <div className="reply-buttons">
              <button
                onClick={handleSubmit}
                disabled={isLoading || !replyText.trim()}
                className="reply-submit-button"
              >
                {isLoading ? "Posting..." : "Reply"}
              </button>
              <button
                onClick={handleCancel}
                className="reply-cancel-button"
              >
                Cancel
              </button>
            </div>
            <span className="reply-character-count">
              {replyText.length}/280
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CommentsPanel({ activity }: CommentsPanelProps) {
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [commentReactions, setCommentReactions] = useState<Record<string, Set<string>>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({});
  const { user } = useUser();
  const { addComment, addReply, deleteComment, toggleCommentReaction } =
    useComments();

  // Update showCommentInput when showInput prop changes
  useEffect(() => {
    setShowCommentInput(false);
  }, []);

  // Update comment reactions state when activity changes
  useEffect(() => {
    const reactions: Record<string, Set<string>> = {};
    const counts: Record<string, Record<string, number>> = {};
    
    activity.comments.forEach((comment) => {
      const userReacts = new Set<string>();
      const commentCounts: Record<string, number> = {};
      
      // Get user reactions
      if (comment.latest_reactions) {
        comment.latest_reactions.forEach((reaction) => {
          if (reaction.user.id === user?.id) {
            userReacts.add(reaction.type);
          }
        });
      }
      
      // Get reaction counts
      if (comment.reaction_groups) {
        Object.entries(comment.reaction_groups).forEach(([type, group]) => {
          commentCounts[type] = group.count || 0;
        });
      }
      
      reactions[comment.id] = userReacts;
      counts[comment.id] = commentCounts;
    });
    
    setCommentReactions(reactions);
    setReactionCounts(counts);
  }, [activity.comments, user]);

  const handleAddComment = async () => {
    if (!newComment.trim() || newComment.length > 280) return;
    try {
      setLoading(true);
      const res = await addComment(activity.id, newComment, "activity");
      if (res) {
        setNewComment("");
        setShowCommentInput(false);
      }
    } catch {
      console.error("Failed to add comment");
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (parentCommentId: string, replyText: string) => {
    if (!replyText.trim() || replyText.length > 280) return;
    try {
      setReplyLoading(true);
      const res = await addReply(
        activity.id,
        replyText,
        parentCommentId,
        "activity"
      );
      if (res) {
        setReplyingTo(null);
      }
    } catch {
      toast.error("Failed to add reply");
    } finally {
      setReplyLoading(false);
    }
  };

  const handleReactToComment = async (
    comment: CommentResponse,
    type: string
  ) => {
    try {
      const hasReaction = !!getUserReactionForComment(comment, type);
      const success = await toggleCommentReaction(comment.id, type, hasReaction, user?.id);
      
      if (success) {
        // Update local state immediately like activity reactions
        setCommentReactions((prev) => {
          const currentReactions = prev[comment.id] || new Set<string>();
          const newReactions = new Set(currentReactions);

          if (hasReaction) {
            // Remove reaction
            newReactions.delete(type);
          } else {
            // Add reaction
            newReactions.add(type);
          }
          return {
            ...prev,
            [comment.id]: newReactions,
          };
        });

        // Update reaction counts immediately
        setReactionCounts((prev) => {
          const currentCounts = prev[comment.id] || {};
          const currentCount = currentCounts[type] || 0;
          
          return {
            ...prev,
            [comment.id]: {
              ...currentCounts,
              [type]: hasReaction ? Math.max(0, currentCount - 1) : currentCount + 1,
            },
          };
        });
      }
    } catch {
      toast.error("Failed to handle comment reaction");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const getUserReactionForComment = (
    comment: CommentResponse,
    type: string
  ) => {
    // Use local state first for immediate updates
    const localReactions = commentReactions[comment.id];
    if (localReactions) {
      return localReactions.has(type);
    }
    
    // Fallback to original comment data
    if (comment.own_reactions && comment.own_reactions.length > 0) {
      return comment.own_reactions.find(
        (reaction) => reaction.type === type
      );
    }
    
    // Fallback to latest_reactions if own_reactions is not available
    return comment.latest_reactions?.find(
      (reaction) => reaction.type === type && reaction.user.id === user?.id
    );
  };

  const getReactionStyles = (comment: CommentResponse, type: string) => {
    const hasReaction = getUserReactionForComment(comment, type);

    switch (type) {
      case "like":
        return `comment-reaction-button like ${hasReaction ? "active" : ""}`;
      default:
        return "comment-reaction-button";
    }
  };

  // Organize comments into hierarchical structure
  const organizeComments = (
    comments: CommentResponse[]
  ): CommentWithReplies[] => {
    const commentMap = new Map<string, CommentWithReplies>();
    const rootComments: CommentWithReplies[] = [];

    // First pass: create map of all comments with empty replies array
    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into hierarchy
    comments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id)!;

      if (comment.parent_id) {
        // This is a reply
        const parentComment = commentMap.get(comment.parent_id);
        if (parentComment) {
          parentComment.replies.push(commentWithReplies);
        }
      } else {
        // This is a root comment
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  };

  // Recursive component to render comment and its replies
  const CommentItem = ({
    comment,
    level = 0,
  }: {
    comment: CommentWithReplies;
    level?: number;
  }) => {
    const indentClass =
      level > 0 ? `ml-${Math.min(level * 8, 32)} reply` : "overflow-hidden";

    return (
      <div className={`${indentClass}`}>
        <div className="comment-item-wrapper">
          <Avatar userName={comment.user.name} size="sm" />
          <div className="comment-item-content">
            <div className="comment-header">
              <span className="comment-author">
                {comment.user?.name || "unknown"}
              </span>
              <span className="comment-separator">•</span>
              <span className="comment-timestamp">
                {comment.created_at &&
                  new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="comment-text">{comment.text}</p>
            <div className="comment-actions">
              <div className="comment-reactions-group">
                <button
                  title="Like"
                  data-cid={comment.id}
                  className={getReactionStyles(comment, "like")}
                  onClick={() => handleReactToComment(comment, "like")}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      getUserReactionForComment(comment, "like")
                        ? "fill-current"
                        : ""
                    }`}
                  />
                </button>
                {(reactionCounts[comment.id]?.["like"] > 0 || (comment.latest_reactions && comment.latest_reactions.length > 0)) && (
                  <span className="comment-reaction-count">
                    {(reactionCounts[comment.id]?.["like"] || (comment.latest_reactions && comment.latest_reactions.length) || 0)} like
                    {(reactionCounts[comment.id]?.["like"] || (comment.latest_reactions && comment.latest_reactions.length) || 0) > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {level === 0 ? (
                <button
                  onClick={() =>
                    setReplyingTo(replyingTo === comment.id ? null : comment.id)
                  }
                  className="comment-reply-button"
                >
                  <TextQuote className="w-4 h-4" /> Reply
                </button>
              ) : null}
              {comment.user?.id === user?.id && (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="comment-delete-button"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>

            {/* Reply Input */}
            {replyingTo === comment.id && (
              <ReplyForm
                comment={comment}
                onReply={(text) => handleReply(comment.id, text)}
                onCancel={() => setReplyingTo(null)}
                isLoading={replyLoading}
              />
            )}
          </div>
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="replies-container">
            <div className="replies-list">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="reply-item">
                  <CommentItem comment={reply} level={level + 1} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="comments-container"
      data-activity-id={activity.id}
    >
      {/* Comment Input Section */}
      {showCommentInput ? (
        <div className="comment-input-section">
          <div className="comment-input-wrapper">
            <Avatar userName={user?.name} size="sm" />
            <div className="comment-input-content">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="comment-textarea"
                style={{ direction: "ltr", textAlign: "left" }}
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (
                      !loading &&
                      newComment.trim() &&
                      newComment.length <= 280
                    ) {
                      handleAddComment();
                    }
                  } else if (e.key === "Escape") {
                    setShowCommentInput(false);
                    setNewComment("");
                  }
                }}
              />
              <div className="comment-controls">
                <div className="comment-buttons">
                  <button
                    onClick={handleAddComment}
                    disabled={loading || !newComment.trim()}
                    className="comment-submit-button"
                  >
                    {loading ? "Posting..." : "Post"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCommentInput(false);
                      setNewComment("");
                    }}
                    className="comment-cancel-button"
                  >
                    Cancel
                  </button>
                </div>
                <span className="comment-character-count">
                  {newComment.length}/280
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="comment-placeholder">
          <button
            onClick={() => setShowCommentInput(true)}
            className="comment-placeholder-button"
          >
            Write a comment...
          </button>
        </div>
      )}

      {/* Comments List */}
      {activity.comments.length > 0 && (
        <div className="comments-list">
          <h3 className="comments-title">
            Comments ({activity.comment_count})
          </h3>
          {organizeComments(activity.comments).map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {activity.comments.length === 0 && !showCommentInput && (
        <div className="comments-empty">
          No comments yet. Be the first to comment!
        </div>
      )}
    </div>
  );
}

