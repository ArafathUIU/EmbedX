import { useState, useCallback } from "react";
import {
  createConversation,
  listConversations,
  getConversation,
  addConversationMessage,
  deleteConversation,
  updateConversationTitle,
  type ConversationData,
  type ConversationSummary,
  type MessageEntry,
} from "../api/client";

interface UseConversationsReturn {
  conversations: ConversationSummary[];
  current: ConversationData | null;
  loading: boolean;
  fetchAll: () => Promise<void>;
  create: (title?: string) => Promise<string>;
  load: (id: string) => Promise<void>;
  addMessage: (msg: Omit<MessageEntry, "timestamp">) => Promise<void>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [current, setCurrent] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listConversations();
      setConversations(res.conversations);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (title = "New Conversation") => {
    const res = await createConversation(title);
    setConversations((prev) => [
      {
        id: res.id,
        title: res.title,
        created_at: res.created_at,
        updated_at: res.updated_at,
        message_count: 0,
      },
      ...prev,
    ]);
    setCurrent(res);
    return res.id;
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await getConversation(id);
      setCurrent(res);
    } finally {
      setLoading(false);
    }
  }, []);

  const addMessage = useCallback(async (msg: Omit<MessageEntry, "timestamp">) => {
    if (!current) return;
    const updated = await addConversationMessage(current.id, msg);
    setCurrent(updated);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === updated.id
          ? { ...c, message_count: updated.message_count, updated_at: updated.updated_at }
          : c
      )
    );
  }, [current]);

  const remove = useCallback(async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (current?.id === id) setCurrent(null);
  }, [current]);

  const rename = useCallback(async (id: string, title: string) => {
    const updated = await updateConversationTitle(id, title);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title: updated.title } : c
      )
    );
    if (current?.id === id) setCurrent(updated);
  }, [current]);

  return { conversations, current, loading, fetchAll, create, load, addMessage, remove, rename };
}
