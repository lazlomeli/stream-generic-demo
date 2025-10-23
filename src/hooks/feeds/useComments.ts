import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CommentResponse,
  AddCommentReactionResponse,
} from "@stream-io/feeds-client";
import { useUser } from "./useUser";
import { FeedsClient } from "@stream-io/feeds-client";
import { useToast } from "../../contexts/ToastContext";

const addCommentToAPI = async (
  client: FeedsClient,
  objectId: string,
  comment: string,
  objectType: string = "activity"
): Promise<CommentResponse> => {
  const res = await client.addComment({
    object_id: objectId,
    object_type: objectType,
    comment: comment.trim(),
    create_notification_activity: true,
  });
  return res.comment;
};

const addReplyToAPI = async (
  client: FeedsClient,
  objectId: string,
  comment: string,
  parentId: string,
  objectType: string = "activity"
): Promise<CommentResponse> => {
  const res = await client.addComment({
    object_id: objectId,
    object_type: objectType,
    parent_id: parentId,
    comment: comment.trim(),
    create_notification_activity: true,
  });
  return res.comment;
};

const deleteCommentFromAPI = async (
  client: FeedsClient,
  commentId: string
): Promise<void> => {
  await client.deleteComment({
    id: commentId,
  });
};

const addCommentReactionToAPI = async (
  client: FeedsClient,
  commentId: string,
  type: string
): Promise<AddCommentReactionResponse> => {
  return await client.addCommentReaction({
    id: commentId,
    type,
    create_notification_activity: true,
  });
};

const deleteCommentReactionFromAPI = async (
  client: FeedsClient,
  commentId: string,
  type: string
): Promise<void> => {
  await client.deleteCommentReaction({
    id: commentId,
    type,
  });
};

export function useComments() {
  const { client } = useUser();
  const { showError } = useToast();
  const queryClient = useQueryClient();

  const addCommentMutation = useMutation({
    mutationFn: async ({
      objectId,
      comment,
      objectType,
    }: {
      objectId: string;
      comment: string;
      objectType?: string;
    }) => {
      if (!comment.trim() || comment.length > 280) {
        throw new Error("Comment must be between 1 and 280 characters");
      }
      if (!client) {
        throw new Error("Client is not available");
      }
      return await addCommentToAPI(client, objectId, comment, objectType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["activities"],
      });
    },
  });

  const addReplyMutation = useMutation({
    mutationFn: async ({
      objectId,
      comment,
      parentId,
      objectType,
    }: {
      objectId: string;
      comment: string;
      parentId: string;
      objectType?: string;
    }) => {
      if (!comment.trim() || comment.length > 280) {
        throw new Error("Reply must be between 1 and 280 characters");
      }
      if (!client) {
        throw new Error("Client is not available");
      }
      return await addReplyToAPI(
        client,
        objectId,
        comment,
        parentId,
        objectType
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["activities"],
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!client) {
        throw new Error("Client is not available");
      }
      await deleteCommentFromAPI(client, commentId);
      return commentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["activities"],
      });
    },
  });

  const addCommentReactionMutation = useMutation({
    mutationFn: async ({
      commentId,
      type,
    }: {
      commentId: string;
      type: string;
    }) => {
      if (!client) {
        throw new Error("Client is not available");
      }
      return await addCommentReactionToAPI(client, commentId, type);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["activities"],
      });
    },
  });

  const deleteCommentReactionMutation = useMutation({
    mutationFn: async ({
      commentId,
      type,
      userId,
    }: {
      commentId: string;
      type: string;
      userId: string;
    }) => {
      if (!client) {
        throw new Error("Client is not available");
      }
      await deleteCommentReactionFromAPI(client, commentId, type);
      return { commentId, type, userId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["activities"],
      });
    },
  });

  const addComment = async (
    objectId: string,
    comment: string,
    objectType?: string
  ): Promise<CommentResponse | null> => {
    try {
      const result = await addCommentMutation.mutateAsync({
        objectId,
        comment,
        objectType,
      });
      return result;
    } catch {
      showError("Failed to add comment");
      return null;
    }
  };

  const addReply = async (
    objectId: string,
    comment: string,
    parentId: string,
    objectType?: string
  ): Promise<CommentResponse | null> => {
    try {
      const result = await addReplyMutation.mutateAsync({
        objectId,
        comment,
        parentId,
        objectType,
      });
      return result;
    } catch {
      showError("Failed to add reply");
      return null;
    }
  };

  const deleteComment = async (commentId: string): Promise<boolean> => {
    try {
      await deleteCommentMutation.mutateAsync(commentId);
      return true;
    } catch {
      showError("Failed to delete comment");
      return false;
    }
  };

  const addCommentReaction = async (
    commentId: string,
    type: string
  ): Promise<boolean> => {
    try {
      await addCommentReactionMutation.mutateAsync({ commentId, type });
      return true;
    } catch {
      showError("Failed to add comment reaction");
      return false;
    }
  };

  const deleteCommentReaction = async (
    commentId: string,
    type: string,
    userId: string
  ): Promise<boolean> => {
    try {
      await deleteCommentReactionMutation.mutateAsync({
        commentId,
        type,
        userId,
      });
      return true;
    } catch {
      showError("Failed to delete comment reaction");
      return false;
    }
  };

  const toggleCommentReaction = async (
    commentId: string,
    type: string,
    hasReaction: boolean,
    userId?: string
  ): Promise<boolean> => {
    if (!userId) return false;

    if (hasReaction) {
      return await deleteCommentReaction(commentId, type, userId);
    } else {
      return await addCommentReaction(commentId, type);
    }
  };

  const getUserReactionForComment = (
    comment: CommentResponse,
    type: string,
    userId: string
  ) => {
    return comment.latest_reactions?.find(
      (reaction) => reaction.user.id === userId && reaction.type === type
    );
  };

  return {
    addComment,
    addReply,
    deleteComment,
    addCommentReaction,
    deleteCommentReaction,
    toggleCommentReaction,
    getUserReactionForComment,
  };
}
