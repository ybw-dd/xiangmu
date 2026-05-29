"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECONNECT_CONFIG = exports.HEARTBEAT_CONFIG = exports.SOCKET_EVENTS = void 0;
exports.userRoom = userRoom;
exports.conversationRoom = conversationRoom;
exports.groupRoom = groupRoom;
exports.SOCKET_EVENTS = {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    HEARTBEAT: 'heartbeat',
    HEARTBEAT_ACK: 'heartbeat_ack',
    MESSAGE_SEND: 'message:send',
    MESSAGE_NEW: 'message:new',
    MESSAGE_ACK: 'message:ack',
    MESSAGE_STATUS: 'message:status',
    MESSAGE_READ: 'message:read',
    MESSAGE_RECALL: 'message:recall',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
    TYPING_UPDATE: 'typing:update',
    PRESENCE_UPDATE: 'presence:update',
    PRESENCE_CHANGED: 'presence:changed',
    CONVERSATION_JOIN: 'conversation:join',
    CONVERSATION_LEAVE: 'conversation:leave',
    CONVERSATION_UPDATE: 'conversation:update',
    SYNC_OFFLINE: 'sync:offline',
    SYNC_REQUEST: 'sync:request',
    NOTIFICATION_NEW: 'notification:new',
    ERROR: 'error',
};
exports.HEARTBEAT_CONFIG = {
    INTERVAL: 25000,
    TIMEOUT: 10000,
    MAX_MISSED: 3,
};
exports.RECONNECT_CONFIG = {
    MAX_ATTEMPTS: 10,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 30000,
    BACKOFF_FACTOR: 1.5,
};
function userRoom(userId) {
    return "user:".concat(userId);
}
function conversationRoom(conversationId) {
    return "conversation:".concat(conversationId);
}
function groupRoom(groupId) {
    return "group:".concat(groupId);
}
//# sourceMappingURL=index.js.map