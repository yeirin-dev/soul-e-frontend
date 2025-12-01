'use client';

import React from 'react';
import styles from './ChatBubble.module.scss';
import { SoulECharacter } from './SoulECharacter';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isLoading?: boolean;
  animationDelay?: number;
  showAvatar?: boolean;
}

export function ChatBubble({
  role,
  content,
  isLoading = false,
  animationDelay = 0,
  showAvatar = true,
}: ChatBubbleProps) {
  const isAssistant = role === 'assistant';
  const isSystem = role === 'system';

  return (
    <div
      className={`${styles.messageContainer} ${styles[role]}`}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      {isAssistant && showAvatar && (
        <div className={styles.avatarSection}>
          <SoulECharacter
            state={isLoading ? 'thinking' : 'avatar'}
            size="small"
            showLabel
          />
        </div>
      )}

      <div className={styles.contentSection}>
        <div className={`${styles.bubble} ${styles.animated}`}>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <span className={styles.text}>{content}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatBubble;
