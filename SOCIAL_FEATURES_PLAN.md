# Social Features Implementation Plan

**Status**: Planning Phase
**Created**: 2025-01-14
**Priority**: Medium

---

## Feature 1: Following/Followers Management Page

### Overview
A dedicated page where users can view and manage their social connections - people they follow, their followers, and mutual friends. Similar to a player search page but focused on user relationships with relevant statistics.

### User Stories
- As a user, I want to see a list of all users I'm following
- As a user, I want to see who is following me
- As a user, I want to see my mutual friends (reciprocal follows)
- As a user, I want to quickly follow/unfollow from these lists
- As a user, I want to see relevant stats for each user (collection size, recent activity, etc.)
- As a user, I want to search/filter these lists

### Database Schema
**No new tables needed** - use existing `user_follow` table with enhanced queries

#### Useful Views (Optional Enhancement)
```sql
-- Mutual friends view (note: prefixed with vw_ to avoid naming conflicts)
CREATE VIEW vw_user_friendships AS
SELECT
  uf1.follower_user_id as user_id,
  uf1.following_user_id as friend_user_id,
  CASE
    WHEN uf1.created > uf2.created THEN uf1.created
    ELSE uf2.created
  END as friendship_date
FROM user_follow uf1
INNER JOIN user_follow uf2
  ON uf1.follower_user_id = uf2.following_user_id
  AND uf1.following_user_id = uf2.follower_user_id
WHERE uf1.follower_user_id < uf1.following_user_id;
```

### API Endpoints

#### Backend Routes: `server/routes/user-social.js`

```javascript
// GET /api/social/following - Get my following list with stats
// Query params: ?limit=50&offset=0&search=username&sort=recent|alphabetical|activity
router.get('/following', authMiddleware, async (req, res) => {
  // Returns: array of users with follow_date, user stats, last_activity
})

// GET /api/social/followers - Get my followers list with stats
// Query params: ?limit=50&offset=0&search=username&sort=recent|alphabetical|activity
router.get('/followers', authMiddleware, async (req, res) => {
  // Returns: array of users with follow_date, user stats, last_activity
})

// GET /api/social/friends - Get mutual friends list with stats
// Query params: ?limit=50&offset=0&search=username&sort=recent|alphabetical|activity
router.get('/friends', authMiddleware, async (req, res) => {
  // Returns: array of users with friendship_date, user stats, last_activity
})

// GET /api/social/suggestions - Get suggested users to follow
// Based on: mutual connections, similar collections, active users
router.get('/suggestions', authMiddleware, async (req, res) => {
  // Returns: array of suggested users with reasoning
})
```

### Frontend Components

#### Main Page: `client/src/pages/Social.jsx`
```jsx
// Route: /social
// Tabs: Following | Followers | Friends | Suggestions
// Features:
// - Tab navigation for different lists
// - Search bar for filtering users
// - Sort dropdown (Recent, Alphabetical, Most Active)
// - User cards with:
//   - Avatar, username, display name
//   - Collection stats (total cards, unique cards, value)
//   - Recent activity indicator
//   - Follow/Unfollow button
//   - "View Profile" link
// - Infinite scroll for large lists
// - Empty states for each tab
```

#### Component: `client/src/components/UserCard.jsx`
```jsx
// Reusable card component for displaying user info
// Props: user, showFollowButton, onFollowChange, stats
// Shows: avatar, name, username, stats, last active, follow button
```

### UI/UX Design Considerations
- **Layout**: Grid layout (2-3 columns on desktop, 1 column on mobile)
- **User Card Design**: Similar to profile header but condensed
- **Stats Display**:
  - Total Cards (with icon)
  - Unique Cards (with icon)
  - Collection Value (with icon)
  - Last Active (relative time)
- **Tab Indicators**: Show counts (Following: 45, Followers: 67, Friends: 23)
- **Suggested Users**: Algorithm based on:
  - Users followed by people you follow
  - Users with similar collection themes (same teams/players)
  - Active users who recently joined
- **Mobile Optimized**: Touch-friendly, swipe gestures for tabs

### Implementation Steps
1. Create backend routes with pagination and search
2. Build reusable UserCard component
3. Create Social page with tab navigation
4. Implement search and filter functionality
5. Add infinite scroll
6. Build suggestion algorithm
7. Add loading states and empty states
8. Mobile responsive design
9. Add to main navigation menu

---

## Feature 2: Messaging System

### Overview
A comprehensive messaging system supporting direct messages (1-on-1) and group chats. Users can communicate about trades, collections, and general card collecting topics.

### User Stories
- As a user, I want to send direct messages to other users
- As a user, I want to create group chats with multiple users
- As a user, I want to see unread message counts
- As a user, I want to receive notifications for new messages
- As a user, I want to search my message history
- As a user, I want to block/report users if needed
- As a user, I want to share cards/collections in messages
- As a user, I want to see when someone is typing
- As a user, I want message read receipts (optional)

### Database Schema

#### Table: `conversation`
```sql
CREATE TABLE conversation (
  conversation_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  conversation_type NVARCHAR(20) NOT NULL, -- 'direct' or 'group'
  conversation_name NVARCHAR(255), -- NULL for direct, required for group
  created_by BIGINT NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  is_active BIT NOT NULL DEFAULT 1,

  CONSTRAINT FK_conversation_creator
    FOREIGN KEY (created_by) REFERENCES [user](user_id),

  CONSTRAINT CK_conversation_type
    CHECK (conversation_type IN ('direct', 'group'))
);

CREATE INDEX IX_conversation_type ON conversation(conversation_type);
CREATE INDEX IX_conversation_updated ON conversation(updated_at DESC);
```

#### Table: `conversation_participant`
```sql
CREATE TABLE conversation_participant (
  participant_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  joined_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  last_read_at DATETIME2,
  is_muted BIT NOT NULL DEFAULT 0,
  is_admin BIT NOT NULL DEFAULT 0, -- For group chats
  left_at DATETIME2, -- When user left the conversation

  CONSTRAINT FK_participant_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id) ON DELETE CASCADE,
  CONSTRAINT FK_participant_user
    FOREIGN KEY (user_id) REFERENCES [user](user_id),

  -- Can't have duplicate participants
  CONSTRAINT UQ_conversation_participant
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX IX_participant_user ON conversation_participant(user_id);
CREATE INDEX IX_participant_conversation ON conversation_participant(conversation_id);
```

#### Table: `message`
```sql
CREATE TABLE message (
  message_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_id BIGINT NOT NULL,
  message_text NVARCHAR(MAX),
  message_type NVARCHAR(20) NOT NULL DEFAULT 'text', -- 'text', 'card_share', 'system'

  -- For card/collection sharing
  shared_card_id BIGINT,
  shared_list_id BIGINT,

  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  edited_at DATETIME2,
  is_deleted BIT NOT NULL DEFAULT 0,

  CONSTRAINT FK_message_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id) ON DELETE CASCADE,
  CONSTRAINT FK_message_sender
    FOREIGN KEY (sender_id) REFERENCES [user](user_id),
  CONSTRAINT FK_message_card
    FOREIGN KEY (shared_card_id) REFERENCES card(card_id),
  CONSTRAINT FK_message_list
    FOREIGN KEY (shared_list_id) REFERENCES user_list(user_list_id),

  CONSTRAINT CK_message_type
    CHECK (message_type IN ('text', 'card_share', 'list_share', 'system'))
);

CREATE INDEX IX_message_conversation ON message(conversation_id, created_at DESC);
CREATE INDEX IX_message_sender ON message(sender_id);
```

#### Table: `message_read_receipt`
```sql
CREATE TABLE message_read_receipt (
  receipt_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  read_at DATETIME2 NOT NULL DEFAULT GETDATE(),

  CONSTRAINT FK_receipt_message
    FOREIGN KEY (message_id) REFERENCES message(message_id) ON DELETE CASCADE,
  CONSTRAINT FK_receipt_user
    FOREIGN KEY (user_id) REFERENCES [user](user_id),

  CONSTRAINT UQ_message_read_receipt
    UNIQUE (message_id, user_id)
);

CREATE INDEX IX_receipt_message ON message_read_receipt(message_id);
CREATE INDEX IX_receipt_user ON message_read_receipt(user_id);
```

#### Table: `user_blocked`
```sql
CREATE TABLE user_blocked (
  block_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  blocker_user_id BIGINT NOT NULL, -- User who blocked
  blocked_user_id BIGINT NOT NULL, -- User who was blocked
  blocked_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  reason NVARCHAR(500),

  CONSTRAINT FK_block_blocker
    FOREIGN KEY (blocker_user_id) REFERENCES [user](user_id),
  CONSTRAINT FK_block_blocked
    FOREIGN KEY (blocked_user_id) REFERENCES [user](user_id),

  CONSTRAINT UQ_user_blocked
    UNIQUE (blocker_user_id, blocked_user_id)
);

CREATE INDEX IX_blocked_blocker ON user_blocked(blocker_user_id);
CREATE INDEX IX_blocked_blocked ON user_blocked(blocked_user_id);
```

### API Endpoints

#### Backend Routes: `server/routes/messages.js`

```javascript
// ==================== Conversations ====================

// GET /api/messages/conversations - Get all conversations for current user
// Returns: list of conversations with last message, unread count, participants
router.get('/conversations', authMiddleware, async (req, res) => {})

// POST /api/messages/conversations - Create new conversation
// Body: { type: 'direct' | 'group', participants: [userId], name?: string }
router.post('/conversations', authMiddleware, async (req, res) => {})

// GET /api/messages/conversations/:conversationId - Get conversation details
router.get('/conversations/:conversationId', authMiddleware, async (req, res) => {})

// PATCH /api/messages/conversations/:conversationId - Update conversation (name, etc)
router.patch('/conversations/:conversationId', authMiddleware, async (req, res) => {})

// DELETE /api/messages/conversations/:conversationId - Leave/delete conversation
router.delete('/conversations/:conversationId', authMiddleware, async (req, res) => {})

// ==================== Messages ====================

// GET /api/messages/conversations/:conversationId/messages - Get messages
// Query: ?limit=50&before=messageId (for pagination)
router.get('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {})

// POST /api/messages/conversations/:conversationId/messages - Send message
// Body: { text: string, type: 'text' | 'card_share', cardId?: number }
router.post('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {})

// PATCH /api/messages/messages/:messageId - Edit message
// Body: { text: string }
router.patch('/messages/:messageId', authMiddleware, async (req, res) => {})

// DELETE /api/messages/messages/:messageId - Delete message
router.delete('/messages/:messageId', authMiddleware, async (req, res) => {})

// ==================== Participants ====================

// POST /api/messages/conversations/:conversationId/participants - Add participants (group only)
// Body: { userIds: [number] }
router.post('/conversations/:conversationId/participants', authMiddleware, async (req, res) => {})

// DELETE /api/messages/conversations/:conversationId/participants/:userId - Remove participant
router.delete('/conversations/:conversationId/participants/:userId', authMiddleware, async (req, res) => {})

// ==================== Read Receipts ====================

// POST /api/messages/conversations/:conversationId/read - Mark conversation as read
router.post('/conversations/:conversationId/read', authMiddleware, async (req, res) => {})

// ==================== Blocking ====================

// POST /api/messages/block/:userId - Block a user
// Body: { reason?: string }
router.post('/block/:userId', authMiddleware, async (req, res) => {})

// DELETE /api/messages/block/:userId - Unblock a user
router.delete('/block/:userId', authMiddleware, async (req, res) => {})

// GET /api/messages/blocked - Get list of blocked users
router.get('/blocked', authMiddleware, async (req, res) => {})

// ==================== Search ====================

// GET /api/messages/search - Search messages
// Query: ?q=searchTerm&conversationId=optional
router.get('/search', authMiddleware, async (req, res) => {})
```

### Real-Time Features (WebSocket)

#### Socket.io Integration
```javascript
// server/sockets/messages.js

// Events to emit:
// - 'message:new' - New message received
// - 'message:edited' - Message was edited
// - 'message:deleted' - Message was deleted
// - 'typing:start' - User started typing
// - 'typing:stop' - User stopped typing
// - 'conversation:updated' - Conversation metadata changed
// - 'participant:joined' - User joined group
// - 'participant:left' - User left group

// Events to listen for:
// - 'join:conversation' - Join a conversation room
// - 'leave:conversation' - Leave a conversation room
// - 'typing' - User is typing
// - 'stop-typing' - User stopped typing
```

### Frontend Components

#### Main Messages Page: `client/src/pages/Messages.jsx`
```jsx
// Route: /messages
// Layout: Two-column (conversation list + active conversation)
// Features:
// - Conversation list sidebar (scrollable, searchable)
// - Active conversation view (messages + input)
// - Unread count badges
// - New message button
// - Search conversations
// - Real-time updates via WebSocket
```

#### Component: `client/src/components/ConversationList.jsx`
```jsx
// Shows list of conversations
// Each item shows: avatar(s), name, last message preview, unread count, timestamp
// Click to open conversation
// Infinite scroll for many conversations
```

#### Component: `client/src/components/ConversationView.jsx`
```jsx
// Active conversation display
// Features:
// - Header with participant info, options menu
// - Message list (infinite scroll up for history)
// - Message input with send button
// - Typing indicators
// - Card/list sharing buttons
// - Message actions (edit, delete for own messages)
// - Read receipts
```

#### Component: `client/src/components/MessageBubble.jsx`
```jsx
// Individual message component
// Styles: different for sent vs received
// Shows: avatar, sender name, message text, timestamp, read status
// Special rendering for card shares
// Actions menu (edit, delete, reply)
```

#### Component: `client/src/components/NewConversationModal.jsx`
```jsx
// Modal for starting new conversation
// Search for users to message
// Option to create group chat
// Multi-select users for group
// Set group name
```

### UI/UX Design Considerations

#### Layout
- **Desktop**: Split view (30% conversation list, 70% active chat)
- **Mobile**: Single view with back button from active chat
- **Responsive breakpoint**: 768px

#### Message Bubbles
- **Sent messages**: Right-aligned, blue gradient
- **Received messages**: Left-aligned, gray
- **System messages**: Centered, italic, smaller

#### Real-Time Updates
- New messages slide in with animation
- Typing indicator shows "Username is typing..."
- Unread badge updates immediately
- Sound notification (optional, user preference)

#### Card Sharing
- Card previews in chat with image thumbnail
- Click to view full card details
- "View Card" button in preview

#### Group Chat Features
- Group avatar (stack of member avatars)
- Participant list in header
- Admin controls (add/remove members, rename group)
- Leave group option

### Implementation Steps

#### Phase 1: Core Infrastructure (Week 1)
1. Create database tables and migrations
2. Set up WebSocket server with Socket.io
3. Build basic API routes (conversations, messages)
4. Create message models and validation

#### Phase 2: Basic Messaging (Week 2)
5. Build ConversationList component
6. Build ConversationView component
7. Build MessageBubble component
8. Implement send/receive messages
9. Real-time message delivery via WebSocket

#### Phase 3: Conversation Management (Week 3)
10. New conversation modal
11. Conversation creation (direct & group)
12. Conversation search
13. Edit/delete messages
14. Leave conversations

#### Phase 4: Advanced Features (Week 4)
15. Typing indicators
16. Read receipts
17. Card/list sharing in messages
18. Unread counts and notifications
19. Block/unblock users

#### Phase 5: Polish & Testing (Week 5)
20. Mobile responsive design
21. Loading states and error handling
22. Empty states
23. Message search functionality
24. Performance optimization (pagination, caching)
25. Security audit (XSS prevention, rate limiting)

### Security Considerations

1. **Rate Limiting**: Prevent spam
   - Max 10 messages per minute per user
   - Max 5 new conversations per hour

2. **Content Moderation**
   - Profanity filter on messages
   - Report message functionality
   - Admin moderation dashboard

3. **Privacy**
   - Only participants can see messages
   - Blocked users can't message
   - Delete removes content permanently

4. **XSS Prevention**
   - Sanitize all message text
   - Escape HTML entities
   - Content Security Policy headers

### Performance Considerations

1. **Message Pagination**: Load 50 messages at a time
2. **Conversation List**: Infinite scroll with virtual scrolling
3. **WebSocket Connection**: Auto-reconnect on disconnect
4. **Database Indexes**: Optimize queries for large message volumes
5. **Caching**: Cache conversation list and unread counts

### Future Enhancements (Post-MVP)

- Voice messages
- Image/file uploads
- Message reactions (emoji)
- Pinned messages
- Message forwarding
- Message threads/replies
- Conversation archiving
- Export conversation history
- Video calls (ambitious!)

---

## Integration Points

### Navigation Updates
Add new menu items:
- **Social** (/social) - Following/Followers page
- **Messages** (/messages) - Messaging page with unread badge

### Notification System Integration
Extend existing notification system:
- New message notifications
- New follower notifications
- Friend request accepted notifications

### Profile Page Integration
Add to profile page:
- "Message" button (appears next to Follow button)
- Opens direct message with that user

### Header Updates
- Messages icon with unread count badge (like notifications)
- Click opens messages page or dropdown preview

---

## Testing Plan

### Unit Tests
- API endpoint functionality
- Message validation
- Permission checks (who can see what)
- Block user functionality

### Integration Tests
- WebSocket message delivery
- Conversation creation flow
- Message editing/deletion
- Group chat operations

### E2E Tests
- Send message flow
- Create group chat flow
- Block user flow
- Mobile responsive layouts

---

## Documentation Needed

1. **API Documentation**: Document all endpoints with request/response examples
2. **WebSocket Events**: Document all socket events and payloads
3. **User Guide**: How to use messaging features
4. **Admin Guide**: How to moderate messages and handle reports

---

## Estimated Timeline

### Following/Followers Page
- Backend API: 2-3 days
- Frontend Components: 3-4 days
- Testing & Polish: 1-2 days
- **Total: 6-9 days**

### Messaging System
- Backend API + Database: 4-5 days
- WebSocket Infrastructure: 2-3 days
- Frontend Components: 5-7 days
- Testing & Polish: 3-4 days
- **Total: 14-19 days (3-4 weeks)**

### Combined Total: 20-28 days (4-6 weeks)

---

## Priority Order

1. **Following/Followers Page** (simpler, builds on existing follow system)
2. **Messaging System** (more complex, requires WebSocket infrastructure)

---

*Document Version: 1.0*
*Last Updated: 2025-01-14*
