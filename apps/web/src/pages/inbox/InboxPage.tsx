import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@leadflow/ui';
import {
  Mail,
  MessageCircle,
  Send,
  Search,
  ArrowLeft,
  User,
  Building,
  Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ==========================================
// TYPES
// ==========================================

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  phone?: string;
}

interface Message {
  id: string;
  leadId: string;
  lead: Lead;
  content: string;
  direction: 'inbound' | 'outbound';
  channel: 'whatsapp' | 'email' | 'instagram';
  status: string;
  sentAt: string;
  createdAt: string;
}

interface Conversation {
  lead: Lead;
  messages: Message[];
  lastMessage: Message;
  unreadCount: number;
}

// ==========================================
// CHANNEL CONFIG
// ==========================================

const CHANNEL_CONFIG = {
  whatsapp: {
    icon: MessageCircle,
    color: 'bg-green-100 text-green-700',
    label: 'WhatsApp',
  },
  email: {
    icon: Mail,
    color: 'bg-blue-100 text-blue-700',
    label: 'Email',
  },
  instagram: {
    icon: Send,
    color: 'bg-pink-100 text-pink-700',
    label: 'Instagram',
  },
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Load messages on mount
  useEffect(() => {
    loadMessages();
  }, []);

  // Group messages into conversations when messages change
  useEffect(() => {
    groupIntoConversations(messages);
  }, [messages]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/inbox');
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupIntoConversations = (msgs: Message[]) => {
    const conversationMap = new Map<string, Conversation>();

    // Group messages by lead
    msgs.forEach((msg) => {
      const existing = conversationMap.get(msg.leadId);
      if (existing) {
        existing.messages.push(msg);
        // Update last message if this one is newer
        if (new Date(msg.sentAt) > new Date(existing.lastMessage.sentAt)) {
          existing.lastMessage = msg;
        }
        // Count unread (inbound messages marked as sent)
        if (msg.direction === 'inbound' && msg.status === 'sent') {
          existing.unreadCount++;
        }
      } else {
        conversationMap.set(msg.leadId, {
          lead: msg.lead,
          messages: [msg],
          lastMessage: msg,
          unreadCount: msg.direction === 'inbound' && msg.status === 'sent' ? 1 : 0,
        });
      }
    });

    // Convert to array and sort by last message date
    const convos = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime()
    );

    setConversations(convos);
  };

  const handleSelectConversation = (convo: Conversation) => {
    // Sort messages by date (oldest first for chat view)
    const sortedMessages = [...convo.messages].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
    setSelectedConversation({ ...convo, messages: sortedMessages });
  };

  const handleSendReply = async () => {
    if (!replyContent.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      const response = await apiFetch('/api/inbox/reply', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedConversation.lead.id,
          content: replyContent,
          channel: selectedConversation.lastMessage.channel,
        }),
      });

      if (!response.ok) throw new Error('Failed to send reply');

      setReplyContent('');
      // Reload messages to show the new reply
      await loadMessages();

      // Re-select the conversation to update it
      const updatedConvo = conversations.find((c) => c.lead.id === selectedConversation.lead.id);
      if (updatedConvo) {
        handleSelectConversation(updatedConvo);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((convo) => {
    // Channel filter
    if (channelFilter !== 'all' && convo.lastMessage.channel !== channelFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName =
        convo.lead.firstName.toLowerCase().includes(query) ||
        convo.lead.lastName.toLowerCase().includes(query);
      const matchesEmail = convo.lead.email.toLowerCase().includes(query);
      const matchesCompany = convo.lead.company?.toLowerCase().includes(query);
      const matchesContent = convo.messages.some((m) => m.content.toLowerCase().includes(query));

      if (!matchesName && !matchesEmail && !matchesCompany && !matchesContent) {
        return false;
      }
    }

    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500 mt-1">View and respond to messages from leads</p>
        </div>
      </div>

      <div className="flex h-[calc(100%-60px)] bg-white rounded-lg shadow overflow-hidden">
        {/* Conversation List */}
        <div
          className={`w-full md:w-1/3 border-r flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Search and Filter */}
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setChannelFilter('all')}
                className={`px-3 py-1 rounded-full text-sm ${
                  channelFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                All
              </button>
              {Object.entries(CHANNEL_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setChannelFilter(key)}
                    className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                      channelFilter === key ? config.color : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {conversations.length === 0
                  ? 'No messages yet. Start a sequence to send messages to leads.'
                  : 'No conversations match your filters.'}
              </div>
            ) : (
              filteredConversations.map((convo) => {
                const channelConfig = CHANNEL_CONFIG[convo.lastMessage.channel];
                const Icon = channelConfig?.icon || Mail;
                const isSelected = selectedConversation?.lead.id === convo.lead.id;

                return (
                  <div
                    key={convo.lead.id}
                    onClick={() => handleSelectConversation(convo)}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                      isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {convo.lead.firstName} {convo.lead.lastName}
                            </span>
                            <div className={`p-1 rounded ${channelConfig?.color || 'bg-gray-100'}`}>
                              <Icon className="h-3 w-3" />
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(convo.lastMessage.sentAt)}
                          </span>
                        </div>
                        {convo.lead.company && (
                          <p className="text-xs text-gray-500 truncate">{convo.lead.company}</p>
                        )}
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {convo.lastMessage.direction === 'outbound' && (
                            <span className="text-gray-400">You: </span>
                          )}
                          {convo.lastMessage.content}
                        </p>
                      </div>
                      {convo.unreadCount > 0 && (
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-500 rounded-full">
                            {convo.unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Conversation Detail */}
        <div
          className={`flex-1 flex flex-col ${selectedConversation ? 'flex' : 'hidden md:flex'}`}
        >
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b flex items-center gap-4">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">
                    {selectedConversation.lead.firstName} {selectedConversation.lead.lastName}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{selectedConversation.lead.email}</span>
                    {selectedConversation.lead.company && (
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {selectedConversation.lead.company}
                      </span>
                    )}
                  </div>
                </div>
                <Badge className={CHANNEL_CONFIG[selectedConversation.lastMessage.channel]?.color}>
                  {CHANNEL_CONFIG[selectedConversation.lastMessage.channel]?.label}
                </Badge>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedConversation.messages.map((msg) => {
                  const isOutbound = msg.direction === 'outbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isOutbound ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <div
                          className={`flex items-center gap-2 mt-1 text-xs ${
                            isOutbound ? 'text-blue-100' : 'text-gray-500'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {new Date(msg.sentAt).toLocaleString()}
                          {isOutbound && <span>({msg.status})</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input */}
              <div className="p-4 border-t">
                <div className="flex gap-3">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  <Button onClick={handleSendReply} disabled={isSending || !replyContent.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
