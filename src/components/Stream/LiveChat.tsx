import React, { useState, useEffect, useRef } from 'react';
import { ref, push, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { rtdb } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import type { ChatMessage } from '../../types';

interface LiveChatProps {
  streamId: string;
}

const LiveChat: React.FC<LiveChatProps> = ({ streamId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesRef = query(
      ref(rtdb, `chats/${streamId}/messages`),
      orderByChild('timestamp'),
      limitToLast(100)
    );

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.entries(data).map(([id, msg]) => ({
          id,
          ...(msg as Omit<ChatMessage, 'id'>),
        }));
        setMessages(messageList.sort((a, b) => a.timestamp - b.timestamp));
      }
    });

    return () => unsubscribe();
  }, [streamId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    const messagesRef = ref(rtdb, `chats/${streamId}/messages`);

    try {
      await push(messagesRef, {
        streamId,
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        message: newMessage.trim(),
        timestamp: Date.now(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-200 rounded-2xl overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="font-bold text-white">الدردشة المباشرة</h3>
        <p className="text-xs text-gray-400">{messages.length} رسالة</p>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-primary-500/30"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex items-start gap-2"
            >
              <img
                src={msg.userPhoto || `https://ui-avatars.com/api/?name=${msg.userName}&background=d946ef&color=fff`}
                alt={msg.userName}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-primary-400">
                    {msg.userName}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-200 break-words">{msg.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-sm">لا توجد رسائل بعد</p>
            <p className="text-xs">كن أول من يعلق!</p>
          </div>
        )}
      </div>

      {/* Message Input */}
      {user ? (
        <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="اكتب تعليقك..."
              className="flex-1 bg-dark-100 text-white placeholder-gray-500 px-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              maxLength={200}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="w-10 h-10 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-white/10 text-center">
          <p className="text-sm text-gray-400">سجل الدخول للمشاركة في الدردشة</p>
        </div>
      )}
    </div>
  );
};

export default LiveChat;
