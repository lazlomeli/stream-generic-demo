import { ActivityResponse, PollState } from "@stream-io/feeds-client";
import { useUser } from "../hooks/feeds/useUser";
import { useState, useEffect } from "react";
import "./Poll.css";

interface PollProps {
  activity: ActivityResponse;
}

export function Poll({ activity }: PollProps) {
  const { client } = useUser();
  const [pollState, setPollState] = useState<PollState | null>(null);

  useEffect(() => {
    if (!activity.poll?.id || !client) return;

    const poll = client.pollFromState(activity.poll.id);
    if (!poll) return;

    // Subscribe to poll state changes
    const unsubscribe = poll.state.subscribe((state) => {
      setPollState(state);
    });

    // Get initial state
    setPollState(poll.state.getLatestValue());

    return () => {
      unsubscribe?.();
    };
  }, [activity.poll?.id, client]);

  const handleVote = async (optionId: string) => {
    if (!client || !activity.poll?.id) return;

    const ownVote = pollState?.own_votes_by_option_id?.[optionId];

    try {
      if (ownVote) {
        // Remove vote
        await client.deletePollVote({
          activity_id: activity.id,
          poll_id: activity.poll.id,
          vote_id: ownVote.id,
        });
      } else {
        // Cast vote
        await client.castPollVote({
          activity_id: activity.id,
          poll_id: activity.poll.id,
          vote: { option_id: optionId },
        });
      }
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  if (!pollState) return null;

  const totalVotes = pollState.vote_count || 0;

  return (
    <div className="activity-poll">
      <div className="activity-poll-question">{pollState.name}</div>
      <div className="activity-poll-options">
        {pollState.options?.map((option) => {
          const voteCount = pollState.vote_counts_by_option?.[option.id] ?? 0;
          const ownVote = pollState.own_votes_by_option_id?.[option.id];
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

          return (
            <div
              key={option.id}
              className={`activity-poll-option ${ownVote ? "voted" : ""}`}
              onClick={() => handleVote(option.id)}
            >
              <div className="activity-poll-option-content">
                <div className="activity-poll-option-text">{option.text}</div>
                <div className="activity-poll-option-votes">
                  {voteCount} {voteCount === 1 ? "vote" : "votes"} ({percentage.toFixed(0)}%)
                </div>
              </div>
              <div 
                className="activity-poll-option-bar" 
                style={{ width: `${percentage}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="activity-poll-total">
        {totalVotes} total {totalVotes === 1 ? "vote" : "votes"}
      </div>
    </div>
  );
}

